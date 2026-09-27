import { Prisma } from "@prisma/client";
import {
  parseJalali,
  toGregorianDate,
  toJalali,
  formatJalali,
  addMonths,
  todayJalali,
} from "@/lib/jalali";
import { getService, listActiveServiceOptions } from "@/modules/services";
import { getServicePaths, listDurations } from "@/modules/paths";
import { listActiveCustomerOptions, saveCaseBirthInfoTx } from "@/modules/customers";
import { listCaseOwnerOptions } from "@/modules/employees";
import { getThresholds, listActiveCancellationReasons } from "@/modules/settings";
import { can, scopeByOwnership, type Authorizable } from "@/modules/permissions";
import {
  createRegistrationPeriodTx,
  getPeriodsForCase,
  currentPeriod,
  stageProgress,
  getStageForAction,
  getPeriodForStageAdd,
  applyStageActionTx,
  addExceptionalStageTx,
  deleteStageTx,
  moveStageTx,
  getActivePeriod,
  getCurrentPeriod,
  getRenewablePeriod,
  getPeriodLifecycle,
  renewPeriodTx,
  setPeriodStatusTx,
  setPeriodFollowUpTx,
  isAbandonable,
  RENEWAL_FORBIDDEN,
  SERVICE_NOT_RENEWABLE,
  NO_ACTIVE_PERIOD,
  PERIOD_NOT_FOUND,
  NOT_ABANDONABLE,
  NOT_ABANDONED,
  START_DATE_INVALID,
  CASE_NOT_FOUND,
  CASE_CANCELLED as PERIOD_CASE_CANCELLED,
  type PeriodRow,
  type StageTemplate,
  type RenewalMeta,
  type RenewalInput,
  type RenewalFollowUpInput,
  type PeriodActionInput,
} from "@/modules/periods";
import type { CustomerType, CaseStatus, Role } from "@/types/enums";
import * as repo from "./cases.repository";
import type {
  CaseCreateInput,
  StageActionInput,
  AddStageInput,
  CaseCancelInput,
  CaseRestoreInput,
} from "./cases.schema";
import {
  CUSTOMER_INVALID,
  SERVICE_INVALID,
  OWNER_INVALID,
  NO_DURATION_DEFINED,
  DURATION_REQUIRED,
  DURATION_INVALID,
  CASE_CANCELLED,
  STAGE_NOT_FOUND,
  STAGE_FORBIDDEN,
  STAGE_INVALID_TRANSITION,
  STAGE_REJECT_NOTE_REQUIRED,
  STAGE_DELETE_NOT_EXCEPTIONAL,
  STAGE_DELETE_HAS_ACTION,
  STAGE_MOVE_NOT_EXCEPTIONAL,
  CANCEL_FORBIDDEN,
  RESTORE_FORBIDDEN,
  ALREADY_CANCELLED,
  CANNOT_CANCEL_COMPLETED,
  NOT_CANCELLED,
  CANCEL_REASON_INVALID,
  aggregateCancellations,
  isStageActionAllowed,
  stageHasRecordedAction,
  daysRemainingUntil,
  type CancellationReport,
} from "./cases.guards";
import type {
  CaseFormData,
  CaseHeader,
  ServiceCaseMeta,
  OwnerOption,
  CaseListItem,
  CaseListParams,
  CaseListResult,
} from "./cases.types";
import { toEnglishDigits } from "@/lib/digits";

// Business logic for the cases domain (C-4 registration, C-5 page). The service
// is the module's only cross-module entry point (rule 9): the service's
// renewable flag + name come from @/modules/services, the initial-path stages
// and validity durations from @/modules/paths, the customer birth-info patch
// from @/modules/customers, and the first period + copied stages from
// @/modules/periods. The single registration write is one transaction (rule 4),
// owned by the repository; this service prepares its inputs, builds the Persian
// notification + JSON history payloads, and retries on a number-collision race.

const CREATE_RETRIES = 5;

function isNumberCollision(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function displayName(row: repo.CaseCoreRow["customer"]): string {
  return row.type === "NATURAL"
    ? row.fullName ?? "—"
    : row.companyName ?? "—";
}

// --- Case-registration form data (C-4) --------------------------------------

/** The pick lists the registration form renders, plus an optional prefilled
 *  customer (from the "register case" button on a customer page). */
export async function getCaseFormData(
  presetCustomerId: string | null,
): Promise<CaseFormData> {
  const [customers, services, ownerRows] = await Promise.all([
    listActiveCustomerOptions(),
    listActiveServiceOptions(),
    listCaseOwnerOptions(),
  ]);
  const owners: OwnerOption[] = ownerRows.map((o) => ({
    id: o.id,
    fullName: o.fullName,
  }));
  return {
    customers,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      renewable: s.renewable,
    })),
    owners,
    presetCustomerId:
      presetCustomerId && customers.some((c) => c.id === presetCustomerId)
        ? presetCustomerId
        : null,
  };
}

/**
 * Live meta for a picked service (C-4): whether it is renewable (drives the
 * duration/expiry section), how many initial stages it has (the hint), and its
 * active validity durations with the default marked. Null when the service is
 * unknown or inactive.
 */
export async function getServiceCaseMeta(
  serviceId: string,
): Promise<ServiceCaseMeta | null> {
  const service = await getService(serviceId);
  if (!service || !service.status) return null;

  const [paths, durations] = await Promise.all([
    getServicePaths(serviceId),
    service.renewable ? listDurations(serviceId) : Promise.resolve([]),
  ]);

  return {
    serviceId,
    renewable: service.renewable,
    stageCount: paths.initial.length,
    durations: durations
      .filter((d) => d.active)
      .map((d) => ({
        id: d.id,
        title: d.title,
        monthCount: d.monthCount,
        isDefault: d.isDefault,
      })),
  };
}

// --- Registration (C-4 save transaction) ------------------------------------

type RegisterResult =
  | { ok: true; id: string; number: string }
  | { ok: false; field?: string; message: string };

/**
 * Register a case (C-4). Validates the three references and, for a renewable
 * service, the chosen validity duration; computes the expiry by Jalali calendar
 * months (rule: never add fixed days); copies the service's initial path stages;
 * then writes the case + first period + stages, backfills the customer's
 * birth-info, notifies the owner, and records history — all in one transaction
 * (rule 4). A number-collision race is retried.
 */
export async function registerCase(
  actorId: string,
  input: CaseCreateInput,
): Promise<RegisterResult> {
  const service = await getService(input.serviceId);
  if (!service || !service.status) {
    return { ok: false, field: "serviceId", message: SERVICE_INVALID };
  }

  const customer = await repo.findCustomerForRegister(input.customerId);
  if (!customer || !customer.status) {
    return { ok: false, field: "customerId", message: CUSTOMER_INVALID };
  }

  if (!(await repo.ownerIsActive(input.ownerId))) {
    return { ok: false, field: "ownerId", message: OWNER_INVALID };
  }

  const startJ = parseJalali(input.startDate);
  if (!startJ) {
    return { ok: false, field: "startDate", message: "تاریخ شروع معتبر نیست." };
  }
  const startDate = toGregorianDate(startJ);

  // Renewable services carry a validity duration and an expiry; non-renewable
  // ones have neither (the period is still created, with a null expiry).
  let expiryDate: Date | null = null;
  if (service.renewable) {
    const durations = (await listDurations(input.serviceId)).filter((d) => d.active);
    if (durations.length === 0) {
      return { ok: false, field: "durationId", message: NO_DURATION_DEFINED };
    }
    const durationId = input.durationId?.trim() ?? "";
    if (!durationId) {
      return { ok: false, field: "durationId", message: DURATION_REQUIRED };
    }
    const duration = durations.find((d) => d.id === durationId);
    if (!duration) {
      return { ok: false, field: "durationId", message: DURATION_INVALID };
    }
    expiryDate = toGregorianDate(addMonths(startJ, duration.monthCount));
  }

  const paths = await getServicePaths(input.serviceId);
  const stages: StageTemplate[] = paths.initial.map((s) => ({
    title: s.title,
    order: s.order,
  }));

  const totalAmount = input.totalAmount === null ? null : BigInt(input.totalAmount);
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  const customerType = customer.type as CustomerType;
  const jalaliYear = todayJalali().jy;

  const args: repo.CreateCaseTxArgs = {
    customerId: input.customerId,
    serviceId: input.serviceId,
    ownerId: input.ownerId,
    actorId,
    notes,
    jalaliYear,
    writePeriod: (tx, caseId) =>
      createRegistrationPeriodTx(tx, {
        caseId,
        startDate,
        expiryDate,
        totalAmount,
        stages,
      }).then(() => undefined),
    writeBirthInfo: (tx) =>
      saveCaseBirthInfoTx(tx, input.customerId, {
        type: customerType,
        birthDate: input.birthDate || undefined,
        foundingDate: input.foundingDate || undefined,
        sendGreeting: input.sendGreeting,
      }),
    buildOwnerMessage: (number) =>
      `پروندهٔ جدید ${number} (${service.name}) به شما ارجاع شد.`,
    buildHistoryDetail: (number) =>
      JSON.stringify({
        number,
        serviceId: input.serviceId,
        customerId: input.customerId,
        ownerId: input.ownerId,
      }),
  };

  for (let attempt = 0; attempt < CREATE_RETRIES; attempt++) {
    try {
      const { id, number } = await repo.createCaseTx(args);
      return { ok: true, id, number };
    } catch (e) {
      if (isNumberCollision(e)) continue; // number race — regenerate and retry
      throw e;
    }
  }
  return {
    ok: false,
    message: "ثبت شمارهٔ پرونده ناموفق بود. دوباره تلاش کنید.",
  };
}

// --- Case page (C-5) --------------------------------------------------------

export type CasePage = {
  header: CaseHeader;
  periods: PeriodRow[];
  current: PeriodRow | null;
};

/**
 * The case page (C-5). The header is fully live: start/expiry come from the
 * current period, daysRemaining and progress are computed at read time (rule 2),
 * never stored. Returns null when the case does not exist.
 */
export async function getCasePage(id: string): Promise<CasePage | null> {
  const core = await repo.findCaseCore(id);
  if (!core) return null;

  const periods = await getPeriodsForCase(id);
  const current = currentPeriod(periods);
  const progress = stageProgress(current);

  const header: CaseHeader = {
    id: core.id,
    number: core.number,
    status: core.status as CaseStatus,
    customerId: core.customerId,
    customerName: displayName(core.customer),
    serviceName: core.service.name,
    ownerId: core.ownerId,
    ownerName: core.owner.fullName,
    startDate: current?.startDate ?? null,
    expiryDate: current?.expiryDate ?? null,
    daysRemaining: daysRemainingUntil(current?.expiryDate ?? null),
    progressPassed: progress.passed,
    progressTotal: progress.total,
  };

  return { header, periods, current };
}

// --- Stage engine (C-6 / Phase 10) ------------------------------------------
// Authorization is server-side (rule 3): the status transitions need
// `stages.advance`, the structural ops (add / delete / reorder an exceptional
// stage) need `stages.add_exceptional`, and BOTH are scoped to the case via
// `cases.edit` on the case record — an employee may act only on their own
// cases unless they hold cases.view_all. The page computes the same booleans to
// show/hide buttons; these functions are the real gate a direct request hits.

/** May the user run the six stage actions on this case? */
export function canEditStages(user: Authorizable, ownerId: string): boolean {
  return can(user, "stages.advance") && can(user, "cases.edit", { ownerId });
}

/** May the user add / delete / reorder an exceptional stage on this case? */
export function canAddStages(user: Authorizable, ownerId: string): boolean {
  return can(user, "stages.add_exceptional") && can(user, "cases.edit", { ownerId });
}

type StageResult = { ok: true } | { ok: false; code: 403 | 404 | 409; message: string };

/** Transition ops (start/done/reject/not_needed/reopen) promote a NEW case to
 *  IN_PROGRESS; a note edit does not (no stage progressed). */
const PROMOTING_OPS = new Set(["start", "done", "reject", "not_needed", "reopen"]);

/**
 * Run one of the six stage actions (C-6). Reads the stage's state + its owning
 * case, authorizes, blocks a cancelled case, validates the transition, then
 * applies the mutation and every side effect in one transaction (rule 4).
 */
export async function runStageAction(
  user: Authorizable,
  stageId: string,
  input: StageActionInput,
): Promise<StageResult> {
  const ctx = await getStageForAction(stageId);
  if (!ctx) return { ok: false, code: 404, message: STAGE_NOT_FOUND };
  const kase = await repo.findCaseForStage(ctx.caseId);
  if (!kase) return { ok: false, code: 404, message: STAGE_NOT_FOUND };

  if (!canEditStages(user, kase.ownerId)) {
    return { ok: false, code: 403, message: STAGE_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: CASE_CANCELLED };
  }
  if (!isStageActionAllowed(input.op, ctx.status)) {
    return { ok: false, code: 409, message: STAGE_INVALID_TRANSITION };
  }
  if (input.op === "reject" && !(input.note && input.note.trim())) {
    return { ok: false, code: 409, message: STAGE_REJECT_NOTE_REQUIRED };
  }

  const note = input.note && input.note.trim() ? input.note.trim() : null;
  await repo.caseMutationTx({
    caseId: ctx.caseId,
    actorId: user.id,
    promoteFromNew: kase.status === "NEW" && PROMOTING_OPS.has(input.op),
    apply: (tx) => applyStageActionTx(tx, { stageId, op: input.op, note, actorId: user.id }),
    historyAction: `stage.${input.op}`,
    historyDetail: JSON.stringify({
      stageId,
      title: ctx.title,
      op: input.op,
      ...(note ? { note } : {}),
    }),
  });
  return { ok: true };
}

/** Add an exceptional stage to the case's current period (C-6). */
export async function addExceptionalStage(
  user: Authorizable,
  input: AddStageInput,
): Promise<StageResult> {
  const period = await getPeriodForStageAdd(input.periodId);
  if (!period) return { ok: false, code: 404, message: STAGE_NOT_FOUND };
  const kase = await repo.findCaseForStage(period.caseId);
  if (!kase) return { ok: false, code: 404, message: STAGE_NOT_FOUND };

  if (!canAddStages(user, kase.ownerId)) {
    return { ok: false, code: 403, message: STAGE_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: CASE_CANCELLED };
  }

  const title = input.title.trim();
  await repo.caseMutationTx({
    caseId: period.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => addExceptionalStageTx(tx, { periodId: input.periodId, title, actorId: user.id }),
    historyAction: "stage.added",
    historyDetail: JSON.stringify({ title, periodId: input.periodId }),
  });
  return { ok: true };
}

/** Delete an exceptional, never-acted stage (C-6: an acted stage can only be set
 *  to Not-Needed). */
export async function deleteStage(user: Authorizable, stageId: string): Promise<StageResult> {
  const ctx = await getStageForAction(stageId);
  if (!ctx) return { ok: false, code: 404, message: STAGE_NOT_FOUND };
  const kase = await repo.findCaseForStage(ctx.caseId);
  if (!kase) return { ok: false, code: 404, message: STAGE_NOT_FOUND };

  if (!canAddStages(user, kase.ownerId)) {
    return { ok: false, code: 403, message: STAGE_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: CASE_CANCELLED };
  }
  if (!ctx.isExceptional) {
    return { ok: false, code: 409, message: STAGE_DELETE_NOT_EXCEPTIONAL };
  }
  if (stageHasRecordedAction(ctx.status, ctx.attemptCount)) {
    return { ok: false, code: 409, message: STAGE_DELETE_HAS_ACTION };
  }

  await repo.caseMutationTx({
    caseId: ctx.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => deleteStageTx(tx, stageId),
    historyAction: "stage.deleted",
    historyDetail: JSON.stringify({ stageId, title: ctx.title }),
  });
  return { ok: true };
}

/** Reorder an exceptional stage one position (C-6: exceptional stages are
 *  reorderable; the defined path order stays fixed). */
export async function moveStage(
  user: Authorizable,
  stageId: string,
  direction: "up" | "down",
): Promise<StageResult> {
  const ctx = await getStageForAction(stageId);
  if (!ctx) return { ok: false, code: 404, message: STAGE_NOT_FOUND };
  const kase = await repo.findCaseForStage(ctx.caseId);
  if (!kase) return { ok: false, code: 404, message: STAGE_NOT_FOUND };

  if (!canAddStages(user, kase.ownerId)) {
    return { ok: false, code: 403, message: STAGE_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: CASE_CANCELLED };
  }
  if (!ctx.isExceptional) {
    return { ok: false, code: 409, message: STAGE_MOVE_NOT_EXCEPTIONAL };
  }

  await repo.caseMutationTx({
    caseId: ctx.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => moveStageTx(tx, { stageId, direction }),
    historyAction: "stage.reordered",
    historyDetail: JSON.stringify({ stageId, direction }),
  });
  return { ok: true };
}

// --- Financial seams (C-7 / Phase 11) ---------------------------------------
// The payments module owns the Payment table and every financial rule; it needs
// two things from cases that only the cases module may provide (rule 9): the
// case's ownership/status (to authorize a financial write, record-scoped like
// the stage engine) and the shared case-mutation transaction (Case.lastActivityAt
// + ActivityHistory are cases-owned). A payment never promotes a NEW case, so
// callers pass promoteFromNew: false.

export type CaseMutationArgs = repo.CaseMutationTxArgs;

/** The case's ownership + status, for authorizing a financial action. Null when
 *  the case does not exist. */
export async function getCaseOwnership(
  caseId: string,
): Promise<{ ownerId: string; status: CaseStatus; number: string } | null> {
  const kase = await repo.findCaseForStage(caseId);
  if (!kase) return null;
  return { ownerId: kase.ownerId, status: kase.status as CaseStatus, number: kase.number };
}

/** Run a case mutation (an injected payment/period-total write) with the case's
 *  last-activity bump + history, in one transaction (rule 4). */
export function runCaseMutation(args: CaseMutationArgs): Promise<void> {
  return repo.caseMutationTx(args);
}

/** Active cases (NEW | IN_PROGRESS) as options for the task form's related-case
 *  picker (C-11 — a task attaches only to an active case). The label pairs the
 *  case number with the customer's display name (type-dependent). */
export async function listActiveCaseOptions(): Promise<
  { id: string; number: string; label: string }[]
> {
  const rows = await repo.findActiveCases();
  return rows.map((c) => {
    const name =
      c.customer.type === "LEGAL"
        ? c.customer.companyName ?? ""
        : c.customer.fullName ?? "";
    return { id: c.id, number: c.number, label: name ? `${c.number} — ${name}` : c.number };
  });
}

// --- Case list, dashboard counts & receivables (C-2 / C-15 / Phase 16) ------
// listCasesView powers both the manager /cases page and the owner-scoped
// /employee/cases page — one query, scoped by scopeByOwnership (rule 3):
// view_all → {} (a manager may optionally narrow to one owner), view_own →
// { ownerId: user.id } (an employee only ever sees their own), no access → an
// empty result. The dashboard counts + receivables reuse the same scope. Balance
// is computed at read time (rule 2), mirroring the customers-service pattern.

const CASE_PAGE_SIZE = 25;

/** Balance across a case's periods: sum(totals) − sum(payments); null when no
 *  period carries a total (the UI shows "—", never zero). Mirrors summarizeCase. */
function caseBalance(
  periods: { totalAmount: bigint | null; payments: { amount: bigint }[] }[],
): number | null {
  let anyTotal = false;
  let totalSum = 0;
  let paidSum = 0;
  for (const p of periods) {
    if (p.totalAmount !== null) {
      anyTotal = true;
      totalSum += Number(p.totalAmount);
    }
    for (const pay of p.payments) paidSum += Number(pay.amount);
  }
  return anyTotal ? totalSum - paidSum : null;
}

function listRowName(c: {
  type: string;
  fullName: string | null;
  companyName: string | null;
}): string {
  return c.type === "LEGAL" ? c.companyName ?? "—" : c.fullName ?? "—";
}

function toCaseListItem(row: repo.CaseListRow): CaseListItem {
  return {
    id: row.id,
    number: row.number,
    customerName: listRowName(row.customer),
    serviceName: row.service.name,
    ownerName: row.owner.fullName,
    status: row.status as CaseStatus,
    balance: caseBalance(row.periods),
    lastActivity: formatJalali(toJalali(row.lastActivityAt), { persianDigits: false }),
  };
}

/** The base ownership filter for a cases query (rule 3), or null when the user
 *  may not view cases at all. A manager (view_all → {}) may optionally narrow to
 *  one owner; an employee (view_own) is always forced to their own. */
function casesScope(
  user: Authorizable,
  ownerId?: string,
): Prisma.CaseWhereInput | null {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return null;
  if ("ownerId" in scope) return scope; // employee: forced to own
  return ownerId ? { ownerId } : {}; // manager: optional narrow
}

/** The cases list for /cases (manager) and /employee/cases (owner-scoped). */
export async function listCasesView(
  user: Authorizable,
  params: CaseListParams,
): Promise<CaseListResult> {
  const base = casesScope(user, params.ownerId);
  const page = Math.max(1, params.page ?? 1);
  if (base === null) {
    return { items: [], total: 0, page: 1, pageCount: 1, pageSize: CASE_PAGE_SIZE };
  }

  const where: Prisma.CaseWhereInput = { ...base };
  const status = params.status ?? "";
  if (status === "active") where.status = { in: ["NEW", "IN_PROGRESS"] };
  else if (status) where.status = status;

  const q = toEnglishDigits((params.q ?? "").trim());
  if (q) {
    where.OR = [
      { number: { contains: q } },
      { customer: { is: { fullName: { contains: q } } } },
      { customer: { is: { companyName: { contains: q } } } },
      { service: { is: { name: { contains: q } } } },
    ];
  }

  if (params.stale) {
    const { staleDays } = await getThresholds();
    where.status = { in: ["NEW", "IN_PROGRESS"] };
    where.lastActivityAt = { lt: new Date(Date.now() - staleDays * DAY_MS) };
  }

  // hasBalance is a computed filter, so that path loads every matching row,
  // filters by balance > 0, and paginates in memory. Every other path lets the
  // DB paginate.
  if (params.hasBalance) {
    const rows = await repo.queryCaseRows(where);
    const items = rows
      .map(toCaseListItem)
      .filter((c) => c.balance !== null && c.balance > 0);
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / CASE_PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * CASE_PAGE_SIZE;
    return {
      items: items.slice(start, start + CASE_PAGE_SIZE),
      total,
      page: safePage,
      pageCount,
      pageSize: CASE_PAGE_SIZE,
    };
  }

  const total = await repo.countCaseRows(where);
  const pageCount = Math.max(1, Math.ceil(total / CASE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = await repo.queryCaseRows(where, {
    skip: (safePage - 1) * CASE_PAGE_SIZE,
    take: CASE_PAGE_SIZE,
  });
  return {
    items: rows.map(toCaseListItem),
    total,
    page: safePage,
    pageCount,
    pageSize: CASE_PAGE_SIZE,
  };
}

/** Active-case count for the dashboard (rule 2), scoped like the list. */
export async function countActiveCases(user: Authorizable): Promise<number> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return 0;
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;
  return repo.countActiveCases(ownerId);
}

/** Stale-case count (active, no activity past the stale threshold) for the
 *  dashboard, scoped like the list. */
export async function countStaleCases(user: Authorizable): Promise<number> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return 0;
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;
  const { staleDays } = await getThresholds();
  return repo.countStaleCases(new Date(Date.now() - staleDays * DAY_MS), ownerId);
}

/** Total outstanding receivables: the sum of POSITIVE balances across active
 *  cases (rule 2), scoped like the list. Credit balances don't net it down. */
export async function getActiveReceivables(user: Authorizable): Promise<number> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return 0;
  const where: Prisma.CaseWhereInput = { status: { in: ["NEW", "IN_PROGRESS"] } };
  if ("ownerId" in scope) where.ownerId = scope.ownerId;
  const rows = await repo.queryCaseRows(where);
  let sum = 0;
  for (const row of rows) {
    const bal = caseBalance(row.periods);
    if (bal !== null && bal > 0) sum += bal;
  }
  return sum;
}

// --- Renewal, follow-up & abandonment (C-9 / C-10 / Phase 13) ---------------
// A renewal is a case-level write that spans the periods module: the cases
// service authorizes (record-scoped, rule 3), validates the duration + start,
// computes the new expiry by Jalali months (rule 2 — never fixed days), copies
// the service's RENEWAL path stages, and runs periods' renewPeriodTx inside
// runCaseMutation so the close-previous / create-next / copy-stages write plus
// Case.lastActivityAt + the ActivityHistory row are ONE transaction (rule 4).
// The manual abandon/restore controls (Phase 15 automates abandonment) and the
// renewal follow-up (which sets Period.followUpStatus + records a note, but
// CANNOT create a FollowUp — resultId is a required FK) follow the same shape.
// `renewals.abandon` has no dedicated permission key, so Abandon is gated under
// `renewals.register`; Restore under `renewals.restore`.

type RenewalResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

/** May the user register a renewal on this case? */
export function canRegisterRenewal(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.register") && can(user, "cases.edit", { ownerId });
}

/** May the user record a renewal follow-up on this case? */
export function canRecordRenewalFollowUp(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.record_followup") && can(user, "cases.edit", { ownerId });
}

/** May the user restore an abandoned period on this case? */
export function canRestore(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.restore") && can(user, "cases.edit", { ownerId });
}

/**
 * Live meta for the renewal form (C-9): whether the case's service is renewable,
 * its active validity durations, and the default start date (the current active
 * period's expiry — the new span begins where the old one ends). Null when the
 * case does not exist.
 */
export async function getRenewalMeta(caseId: string): Promise<RenewalMeta | null> {
  const kase = await repo.findCaseForRenewal(caseId);
  if (!kase) return null;

  const service = await getService(kase.serviceId);
  const renewable = !!service?.renewable;

  const [durations, active] = await Promise.all([
    renewable ? listDurations(kase.serviceId) : Promise.resolve([]),
    getRenewablePeriod(caseId),
  ]);

  return {
    renewable,
    durations: durations
      .filter((d) => d.active)
      .map((d) => ({
        id: d.id,
        title: d.title,
        monthCount: d.monthCount,
        isDefault: d.isDefault,
      })),
    defaultStartDate: active?.expiryDate ?? null,
  };
}

// RENEWAL_ACTIONS_PLACEHOLDER

/**
 * Register a renewal (C-9). Authorizes (record-scoped), blocks a cancelled case,
 * checks the service is renewable and the chosen duration is valid, computes the
 * new expiry by Jalali months, copies the RENEWAL path stages, then closes the
 * previous period (→ RENEWED) and creates the next ACTIVE period — all in one
 * transaction (rule 4). The reminder cycle restarts automatically (SentReminder
 * is keyed by the new periodId).
 */
export async function registerRenewal(
  user: Authorizable,
  input: RenewalInput,
): Promise<RenewalResult> {
  const kase = await repo.findCaseForRenewal(input.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canRegisterRenewal(user, kase.ownerId)) {
    return { ok: false, code: 403, message: RENEWAL_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: PERIOD_CASE_CANCELLED };
  }

  const service = await getService(kase.serviceId);
  if (!service?.renewable) {
    return { ok: false, code: 409, message: SERVICE_NOT_RENEWABLE };
  }

  const durations = (await listDurations(kase.serviceId)).filter((d) => d.active);
  if (durations.length === 0) {
    return { ok: false, code: 409, message: NO_DURATION_DEFINED };
  }
  const durationId = input.durationId?.trim() ?? "";
  if (!durationId) {
    return { ok: false, code: 422, message: DURATION_REQUIRED };
  }
  const duration = durations.find((d) => d.id === durationId);
  if (!duration) {
    return { ok: false, code: 422, message: DURATION_INVALID };
  }

  const startJ = parseJalali(input.startDate);
  if (!startJ) {
    return { ok: false, code: 422, message: START_DATE_INVALID };
  }
  const startDate = toGregorianDate(startJ);
  const expiryDate = toGregorianDate(addMonths(startJ, duration.monthCount));

  const active = await getRenewablePeriod(input.caseId);
  if (!active) {
    return { ok: false, code: 409, message: NO_ACTIVE_PERIOD };
  }

  const paths = await getServicePaths(kase.serviceId);
  const stages: StageTemplate[] = paths.renewal.map((s) => ({
    title: s.title,
    order: s.order,
  }));

  const totalAmount = input.renewalAmount === null ? null : BigInt(input.renewalAmount);

  await repo.caseMutationTx({
    caseId: input.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) =>
      renewPeriodTx(tx, {
        previousPeriodId: active.id,
        caseId: input.caseId,
        indexNumber: active.indexNumber + 1,
        startDate,
        expiryDate,
        totalAmount,
        stages,
      }).then(() => undefined),
    historyAction: "period.renewed",
    historyDetail: JSON.stringify({
      previousPeriodId: active.id,
      indexNumber: active.indexNumber + 1,
      durationId,
    }),
  });
  return { ok: true };
}

// RENEWAL_FOLLOWUP_PLACEHOLDER

/**
 * Record a renewal follow-up (C-9). Sets the active period's follow-up status and
 * records the note in ActivityHistory — it does NOT create a FollowUp row (that
 * requires a result FK, C-11). One transaction (rule 4). Authorization is
 * record-scoped: `renewals.record_followup` + `cases.edit` on the owner.
 */
export async function recordRenewalFollowUp(
  user: Authorizable,
  input: RenewalFollowUpInput,
): Promise<RenewalResult> {
  const kase = await repo.findCaseForRenewal(input.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canRecordRenewalFollowUp(user, kase.ownerId)) {
    return { ok: false, code: 403, message: RENEWAL_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: PERIOD_CASE_CANCELLED };
  }

  const active = await getRenewablePeriod(input.caseId);
  if (!active) {
    return { ok: false, code: 409, message: NO_ACTIVE_PERIOD };
  }

  const note = input.note && input.note.trim() ? input.note.trim() : null;

  await repo.caseMutationTx({
    caseId: input.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => setPeriodFollowUpTx(tx, active.id, { followUpStatus: input.followUpStatus }),
    historyAction: "period.followup",
    historyDetail: JSON.stringify({
      periodId: active.id,
      followUpStatus: input.followUpStatus,
      ...(note ? { note } : {}),
    }),
  });
  return { ok: true };
}

/**
 * Manually abandon an expired, past-threshold period (C-10). The engine automates
 * this in Phase 15; here a user with `renewals.register` on the case may do it
 * when the abandonment rule holds (isAbandonable — expired past the threshold, or
 * "Not interested" immediately). One transaction (rule 4).
 */
export async function abandonPeriod(
  user: Authorizable,
  input: PeriodActionInput,
): Promise<RenewalResult> {
  const lifecycle = await getPeriodLifecycle(input.periodId);
  if (!lifecycle) return { ok: false, code: 404, message: PERIOD_NOT_FOUND };
  const kase = await repo.findCaseForRenewal(lifecycle.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canRegisterRenewal(user, kase.ownerId)) {
    return { ok: false, code: 403, message: RENEWAL_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: PERIOD_CASE_CANCELLED };
  }

  const { abandonmentDays } = await getThresholds();
  const abandonable = isAbandonable(
    {
      status: lifecycle.status,
      daysRemaining: lifecycle.daysRemaining,
      followUpStatus: lifecycle.followUpStatus,
    },
    abandonmentDays,
  );
  if (!abandonable) {
    return { ok: false, code: 409, message: NOT_ABANDONABLE };
  }

  await repo.caseMutationTx({
    caseId: lifecycle.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => setPeriodStatusTx(tx, input.periodId, "ABANDONED"),
    historyAction: "period.abandoned",
    historyDetail: JSON.stringify({ periodId: input.periodId, indexNumber: lifecycle.indexNumber }),
  });
  return { ok: true };
}

/**
 * Restore an abandoned period (C-10): ABANDONED → ACTIVE, recorded in history.
 * Authorization is record-scoped: `renewals.restore` + `cases.edit` on the owner.
 */
export async function restorePeriod(
  user: Authorizable,
  input: PeriodActionInput,
): Promise<RenewalResult> {
  const lifecycle = await getPeriodLifecycle(input.periodId);
  if (!lifecycle) return { ok: false, code: 404, message: PERIOD_NOT_FOUND };
  const kase = await repo.findCaseForRenewal(lifecycle.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canRestore(user, kase.ownerId)) {
    return { ok: false, code: 403, message: RENEWAL_FORBIDDEN };
  }
  if (lifecycle.status !== "ABANDONED") {
    return { ok: false, code: 409, message: NOT_ABANDONED };
  }

  await repo.caseMutationTx({
    caseId: lifecycle.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => setPeriodStatusTx(tx, input.periodId, "ACTIVE"),
    historyAction: "period.restored",
    historyDetail: JSON.stringify({ periodId: input.periodId, indexNumber: lifecycle.indexNumber }),
  });
  return { ok: true };
}

// --- Case cancellation & restore (C-8 / Phase 14) ---------------------------
// Cancelling a case is a case-level write that fans out across three modules in
// ONE transaction (rule 4): the Case row (status + who/why/when), its active
// period (→ CANCELLED, via the periods seam), and every open task of the case
// (→ CANCELLED + a notification per owner, via the tasks seam). The tasks seam is
// INJECTED by the API route rather than imported here: tasks already depends on
// cases (listActiveCaseOptions), so a cases→tasks import would cycle (rule 9).
// The path is "locked" purely as a consequence of CANCELLED status — the stage
// service already 409s on a cancelled case, so no stage write is needed here.
// Payments, the total and the balance are deliberately left untouched, and the
// case is never deleted (it stays in search, customer history and reports).

const DAY_MS = 24 * 60 * 60 * 1000;

/** The tasks-module seam the cancel transaction injects (see the note above). */
type CancelOpenTasksTxFn = (
  tx: Prisma.TransactionClient,
  args: { caseId: string; message: string },
) => Promise<void>;

type CancelRestoreResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

/** May the user cancel this case? `cases.cancel` scoped by `cases.edit` on the
 *  owner (rule 3) — the API route re-checks; the page uses it to show the button. */
export function canCancelCase(user: Authorizable, ownerId: string): boolean {
  return can(user, "cases.cancel") && can(user, "cases.edit", { ownerId });
}

/** May the user restore this cancelled case? MANAGER ONLY (C-8) — SUPERVISOR
 *  holds `cases.restore` by default, so the role gate is the defining rule. */
export function canRestoreCase(user: Authorizable, role: Role, ownerId: string): boolean {
  return role === "MANAGER" && can(user, "cases.restore") && can(user, "cases.edit", { ownerId });
}

/** The cancellation detail for a cancelled case's header (C-8): the Jalali date
 *  (ASCII "YYYY/MM/DD" — the page applies Persian digits), reason title, note and
 *  canceller name. Null when the case does not exist. */
export async function getCancellationDetail(caseId: string): Promise<{
  date: string | null;
  reasonTitle: string | null;
  note: string | null;
  cancelledByName: string | null;
} | null> {
  const d = await repo.findCancellationDetail(caseId);
  if (!d) return null;
  return {
    date: d.cancelledAt ? formatJalali(toJalali(d.cancelledAt), { persianDigits: false }) : null,
    reasonTitle: d.reasonTitle,
    note: d.note,
    cancelledByName: d.cancelledByName,
  };
}

/**
 * Cancel a case (C-8). Authorizes (record-scoped), blocks an already-cancelled or
 * completed case, and re-validates the reason against the active list (rule 3).
 * Then, in one transaction: mark the case CANCELLED with who/why/when, cancel its
 * active period, and cancel + notify every open task (the injected tasks seam),
 * plus the case last-activity bump and a history record. The Persian task
 * notification text is built here (never in the repository/seam).
 */
export async function cancelCase(
  user: Authorizable,
  input: CaseCancelInput,
  cancelOpenTasksTx: CancelOpenTasksTxFn,
): Promise<CancelRestoreResult> {
  const kase = await repo.findCaseForStage(input.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canCancelCase(user, kase.ownerId)) {
    return { ok: false, code: 403, message: CANCEL_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: ALREADY_CANCELLED };
  }
  if (kase.status === "COMPLETED") {
    return { ok: false, code: 409, message: CANNOT_CANCEL_COMPLETED };
  }

  const reasons = await listActiveCancellationReasons();
  const reason = reasons.find((r) => r.id === input.cancellationReasonId);
  if (!reason) return { ok: false, code: 422, message: CANCEL_REASON_INVALID };

  const note = input.note && input.note.trim() ? input.note.trim() : null;
  const active = await getActivePeriod(input.caseId);
  const taskMessage = `پروندهٔ ${kase.number} لغو شد؛ کارهای باز آن بسته شدند.`;

  await repo.caseMutationTx({
    caseId: input.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: async (tx) => {
      await repo.setCaseCancelledTx(tx, {
        caseId: input.caseId,
        reasonId: input.cancellationReasonId,
        note,
        cancelledById: user.id,
      });
      if (active) await setPeriodStatusTx(tx, active.id, "CANCELLED");
      await cancelOpenTasksTx(tx, { caseId: input.caseId, message: taskMessage });
    },
    historyAction: "case.cancelled",
    historyDetail: JSON.stringify({
      reasonId: input.cancellationReasonId,
      reasonTitle: reason.title,
      ...(note ? { note } : {}),
    }),
  });
  return { ok: true };
}

/**
 * Restore a cancelled case (C-8) — MANAGER ONLY. Sets the case back to
 * IN_PROGRESS (clearing the cancellation fields) and reactivates the period that
 * was cancelled alongside it (the current, highest-index one, only if CANCELLED),
 * in one transaction with the history record.
 */
export async function restoreCase(
  user: Authorizable,
  role: Role,
  input: CaseRestoreInput,
): Promise<CancelRestoreResult> {
  const kase = await repo.findCaseForStage(input.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };
  if (!canRestoreCase(user, role, kase.ownerId)) {
    return { ok: false, code: 403, message: RESTORE_FORBIDDEN };
  }
  if (kase.status !== "CANCELLED") {
    return { ok: false, code: 409, message: NOT_CANCELLED };
  }

  const current = await getCurrentPeriod(input.caseId);
  await repo.caseMutationTx({
    caseId: input.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: async (tx) => {
      await repo.restoreCaseStatusTx(tx, input.caseId);
      if (current && current.status === "CANCELLED") {
        await setPeriodStatusTx(tx, current.id, "ACTIVE");
      }
    },
    historyAction: "case.restored",
    historyDetail: JSON.stringify({ caseId: input.caseId }),
  });
  return { ok: true };
}

/**
 * The cancellation report (B-5): count of cancelled cases in a Jalali date range,
 * broken down by reason (desc by count). The `to` day is inclusive (the query ends
 * at the next midnight). Returns null when either bound is not a valid Jalali date
 * (the page validates first and falls back to a default range).
 */
export async function getCancellationReport(
  fromStr: string,
  toStr: string,
): Promise<CancellationReport | null> {
  const fromJ = parseJalali(fromStr);
  const toJ = parseJalali(toStr);
  if (!fromJ || !toJ) return null;
  const from = toGregorianDate(fromJ);
  const to = new Date(toGregorianDate(toJ).getTime() + DAY_MS);
  const rows = await repo.findCancellationsInRange(from, to);
  return aggregateCancellations(rows);
}
