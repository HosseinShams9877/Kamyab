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
  periodHasOpenStages,
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
  CaseChangeOwnerInput,
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
  CHANGE_OWNER_FORBIDDEN,
  NEW_OWNER_INVALID,
  SAME_OWNER,
  CASE_NOT_CHANGEABLE,
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
  CaseStats,
  ServiceFilterOption,
  OwnerFilterOption,
  OwnerChangeMeta,
  ChangeOwnerResult,
} from "./cases.types";
import { toEnglishDigits } from "@/lib/digits";

// Business logic for the cases domain (C-4 registration, C-5 page). The service
// is the module's only cross-module entry point (rule 9).

const CREATE_RETRIES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function isNumberCollision(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function displayName(row: repo.CaseCoreRow["customer"]): string {
  return row.type === "NATURAL"
    ? row.fullName ?? "—"
    : row.companyName ?? "—";
}

// --- Case-registration form data (C-4) --------------------------------------

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
      if (isNumberCollision(e)) continue;
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

export function canEditStages(user: Authorizable, ownerId: string): boolean {
  return can(user, "stages.advance") && can(user, "cases.edit", { ownerId });
}

export function canAddStages(user: Authorizable, ownerId: string): boolean {
  return can(user, "stages.add_exceptional") && can(user, "cases.edit", { ownerId });
}

type StageResult = { ok: true } | { ok: false; code: 403 | 404 | 409; message: string };

const PROMOTING_OPS = new Set(["start", "done", "reject", "not_needed", "reopen"]);
const COMPLETING_OPS = new Set(["done", "not_needed"]);

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
    apply: async (tx) => {
      await applyStageActionTx(tx, {
        stageId,
        op: input.op,
        note,
        actorId: user.id,
      });
      // After a completing op, if the period has no open stage left, flip the
      // case to COMPLETED in the same transaction (C-6 side effect #4).
      if (COMPLETING_OPS.has(input.op)) {
        const hasOpen = await periodHasOpenStages(tx, ctx.periodId);
        if (!hasOpen) {
          await tx.case.update({
            where: { id: ctx.caseId },
            data: { status: "COMPLETED" },
          });
        }
      }
      // On Reopen of a previously-completed case, flip it back to IN_PROGRESS.
      if (input.op === "reopen" && kase.status === "COMPLETED") {
        await tx.case.update({
          where: { id: ctx.caseId },
          data: { status: "IN_PROGRESS" },
        });
      }
    },
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

export type CaseMutationArgs = repo.CaseMutationTxArgs;

export async function getCaseOwnership(
  caseId: string,
): Promise<{ ownerId: string; status: CaseStatus; number: string } | null> {
  const kase = await repo.findCaseForStage(caseId);
  if (!kase) return null;
  return { ownerId: kase.ownerId, status: kase.status as CaseStatus, number: kase.number };
}

export function runCaseMutation(args: CaseMutationArgs): Promise<void> {
  return repo.caseMutationTx(args);
}

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

const CASE_PAGE_SIZE = 10;

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

function currentStageTitle(
  periods: {
    status: string;
    stages: { order: number; status: string; title: string }[];
  }[],
): string | null {
  const active = periods.find((p) => p.status === "ACTIVE");
  if (!active || active.stages.length === 0) return null;
  const open = active.stages.find(
    (s) => s.status === "PENDING" || s.status === "IN_PROGRESS" || s.status === "REJECTED",
  );
  return open ? open.title : null;
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
    currentStageTitle: currentStageTitle(row.periods),
    lastActivity: formatJalali(toJalali(row.lastActivityAt), { persianDigits: false }),
  };
}

function casesScope(
  user: Authorizable,
  ownerId?: string,
): Prisma.CaseWhereInput | null {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return null;
  if ("ownerId" in scope) return scope;
  return ownerId ? { ownerId } : {};
}

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

  if (params.serviceId && params.serviceId.trim()) {
    where.serviceId = params.serviceId.trim();
  }

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

export async function countActiveCases(user: Authorizable): Promise<number> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return 0;
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;
  return repo.countActiveCases(ownerId);
}

export async function countStaleCases(user: Authorizable): Promise<number> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) return 0;
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;
  const { staleDays } = await getThresholds();
  return repo.countStaleCases(new Date(Date.now() - staleDays * DAY_MS), ownerId);
}

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

export async function getCaseStats(user: Authorizable): Promise<CaseStats> {
  const scope = scopeByOwnership(user, "cases");
  if (scope === null) {
    return { total: 0, active: 0, waitingAction: 0, completedThisMonth: 0 };
  }
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;

  const todayJ = todayJalali();
  const monthStart = toGregorianDate({ jy: todayJ.jy, jm: todayJ.jm, jd: 1 });
  const monthEnd = toGregorianDate(addMonths({ jy: todayJ.jy, jm: todayJ.jm, jd: 1 }, 1));

  const totalWhere: Prisma.CaseWhereInput = ownerId ? { ownerId } : {};
  const activeWhere: Prisma.CaseWhereInput = {
    status: { in: ["NEW", "IN_PROGRESS"] },
    ...(ownerId ? { ownerId } : {}),
  };

  const [total, active, waitingAction, completedThisMonth] = await Promise.all([
    repo.countCaseRows(totalWhere),
    repo.countCaseRows(activeWhere),
    repo.countActiveWithOpenStage(ownerId),
    repo.countCompletedBetween(monthStart, monthEnd, ownerId),
  ]);

  return { total, active, waitingAction, completedThisMonth };
}

export async function listServiceFilterOptions(): Promise<ServiceFilterOption[]> {
  const rows = await listActiveServiceOptions();
  return rows.map((s) => ({ id: s.id, name: s.name }));
}

export async function listOwnerFilterOptions(): Promise<OwnerFilterOption[]> {
  const rows = await listCaseOwnerOptions();
  return rows.map((o) => ({ id: o.id, fullName: o.fullName }));
}

// --- Renewal, follow-up & abandonment (C-9 / C-10 / Phase 13) ---------------

type RenewalResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

export function canRegisterRenewal(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.register") && can(user, "cases.edit", { ownerId });
}

export function canRecordRenewalFollowUp(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.record_followup") && can(user, "cases.edit", { ownerId });
}

export function canRestore(user: Authorizable, ownerId: string): boolean {
  return can(user, "renewals.restore") && can(user, "cases.edit", { ownerId });
}

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

type CancelOpenTasksTxFn = (
  tx: Prisma.TransactionClient,
  args: { caseId: string; message: string },
) => Promise<void>;

type CancelRestoreResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

export function canCancelCase(user: Authorizable, ownerId: string): boolean {
  return can(user, "cases.cancel") && can(user, "cases.edit", { ownerId });
}

export function canRestoreCase(user: Authorizable, role: Role, ownerId: string): boolean {
  return role === "MANAGER" && can(user, "cases.restore") && can(user, "cases.edit", { ownerId });
}

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

// --- Change owner (C-5 header action) ---------------------------------------

export function canChangeOwner(user: Authorizable, ownerId: string): boolean {
  return (
    can(user, "cases.assign_owner") &&
    can(user, "cases.edit", { ownerId })
  );
}

export async function getOwnerChangeMeta(
  caseId: string,
): Promise<OwnerChangeMeta | null> {
  const kase = await repo.findCaseForOwnerChange(caseId);
  if (!kase) return null;

  const [candidates, openTasks] = await Promise.all([
    listOwnerFilterOptions(),
    repo.countOpenTasksForCase(caseId),
  ]);

  return {
    currentOwnerId: kase.ownerId,
    candidates: candidates.filter((c) => c.id !== kase.ownerId),
    openTasks,
  };
}

export async function changeCaseOwner(
  user: Authorizable,
  input: CaseChangeOwnerInput,
): Promise<ChangeOwnerResult> {
  const kase = await repo.findCaseForOwnerChange(input.caseId);
  if (!kase) return { ok: false, code: 404, message: CASE_NOT_FOUND };

  if (!canChangeOwner(user, kase.ownerId)) {
    return { ok: false, code: 403, message: CHANGE_OWNER_FORBIDDEN };
  }
  if (kase.status === "CANCELLED") {
    return { ok: false, code: 409, message: CASE_NOT_CHANGEABLE };
  }
  if (input.newOwnerId === kase.ownerId) {
    return { ok: false, code: 409, message: SAME_OWNER };
  }
  if (!(await repo.ownerIsActive(input.newOwnerId))) {
    return { ok: false, code: 422, message: NEW_OWNER_INVALID };
  }

  const note = input.note && input.note.trim() ? input.note.trim() : null;
  const message = `پروندهٔ ${kase.number} به شما ارجاع شد.`;

  let movedTasks = 0;
  await repo.caseMutationTx({
    caseId: input.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: async (tx) => {
      await repo.setCaseOwnerTx(tx, {
        caseId: input.caseId,
        newOwnerId: input.newOwnerId,
      });
      if (input.moveOpenTasks) {
        movedTasks = await repo.moveOpenCaseTasksTx(tx, {
          caseId: input.caseId,
          newOwnerId: input.newOwnerId,
        });
      }
      await repo.notifyOwnerChangeTx(tx, {
        userId: input.newOwnerId,
        message,
      });
    },
    historyAction: "case.owner_changed",
    historyDetail: JSON.stringify({
      fromOwnerId: kase.ownerId,
      toOwnerId: input.newOwnerId,
      movedTasks,
      ...(note ? { note } : {}),
    }),
  });

  return { ok: true, movedTasks };
}