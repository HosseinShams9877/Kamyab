import { Prisma } from "@prisma/client";
import {
  parseJalali,
  toGregorianDate,
  addMonths,
  todayJalali,
} from "@/lib/jalali";
import { getService, listActiveServiceOptions } from "@/modules/services";
import { getServicePaths, listDurations } from "@/modules/paths";
import { listActiveCustomerOptions, saveCaseBirthInfoTx } from "@/modules/customers";
import { listCaseOwnerOptions } from "@/modules/employees";
import { getThresholds } from "@/modules/settings";
import { can, type Authorizable } from "@/modules/permissions";
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
import type { CustomerType, CaseStatus } from "@/types/enums";
import * as repo from "./cases.repository";
import type { CaseCreateInput, StageActionInput, AddStageInput } from "./cases.schema";
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
  isStageActionAllowed,
  stageHasRecordedAction,
  daysRemainingUntil,
} from "./cases.guards";
import type {
  CaseFormData,
  CaseHeader,
  ServiceCaseMeta,
  OwnerOption,
} from "./cases.types";

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
