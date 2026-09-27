import type { Prisma } from "@prisma/client";
import { toJalali, formatJalali } from "@/lib/jalali";
import type { PeriodStatus, FollowUpStatus, StageStatus } from "@/types/enums";
import { getThresholds } from "@/modules/settings";
import * as repo from "./periods.repository";
import { isAbandonable, inRenewalTab, type RenewalTab } from "./periods.guards";
import type {
  PeriodRow,
  StageRow,
  RegistrationPeriodInput,
  RenewPeriodInput,
  RenewablePeriod,
  PeriodLifecycle,
  RenewalRow,
  StageActionContext,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
  EngineReminderCandidate,
  EngineUnfollowedRenewal,
} from "./periods.types";

// Business logic for the periods domain. Jalali<->Date conversion and the
// read-time financial computation (rule 2) live here; the repository stays a
// thin DB layer. The single write path in Phase 9 is the case-creation seam
// re-exported below (the six stage actions and renewals come in later phases).

// A stage is "passed" when Done or explicitly Not Needed (C-6 progress rule).
const PASSED_STAGE_STATUSES = ["DONE", "NOT_NEEDED"];

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date | null): string | null {
  if (!date) return null;
  return formatJalali(toJalali(date), { persianDigits: false });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from today until a stored expiry Date: positive when ahead, negative
 * once passed, null with no expiry. Computed at read time (rule 2). Kept inside
 * the periods module (from the raw Date) so periods never imports cases.guards —
 * that would make the module DAG cyclic (cases → periods). `now` is injectable so
 * the count is deterministic in tests.
 */
function daysRemainingFromDate(expiry: Date | null, now: Date = new Date()): number | null {
  if (!expiry) return null;
  const e = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((e.getTime() - today.getTime()) / DAY_MS);
}

/** The customer's display name from the type-dependent columns (renewals queue). */
function customerDisplayName(c: {
  type: string;
  fullName: string | null;
  companyName: string | null;
}): string {
  return c.type === "LEGAL" ? c.companyName ?? "—" : c.fullName ?? "—";
}

function mapStage(s: repo.PeriodWithDetail["stages"][number]): StageRow {
  return {
    id: s.id,
    title: s.title,
    order: s.order,
    status: s.status as StageStatus,
    isExceptional: s.isExceptional,
    startDate: dateToJalali(s.startedAt),
    endDate: dateToJalali(s.endedAt),
    attemptCount: s.attemptCount,
    note: s.note,
    lastChangedByName: s.lastChangedBy?.fullName ?? null,
  };
}

function mapPeriod(p: repo.PeriodWithDetail): PeriodRow {
  const total = p.totalAmount === null ? null : Number(p.totalAmount);
  const paid = p.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  return {
    id: p.id,
    indexNumber: p.indexNumber,
    status: p.status as PeriodStatus,
    startDate: dateToJalali(p.startDate) ?? "",
    expiryDate: dateToJalali(p.expiryDate),
    totalAmount: total,
    followUpStatus: p.followUpStatus as FollowUpStatus,
    stages: p.stages.map(mapStage),
    paid,
    balance: total === null ? null : total - paid,
  };
}

/** All periods of a case (newest first), ready for the case page (C-5). */
export async function getPeriodsForCase(caseId: string): Promise<PeriodRow[]> {
  const rows = await repo.findPeriodsByCase(caseId);
  return rows.map(mapPeriod);
}

/** The active period, else the most recent — the one the case page's cards
 *  describe ("current path" rule, C-5). */
export function currentPeriod(periods: PeriodRow[]): PeriodRow | null {
  return periods.find((p) => p.status === "ACTIVE") ?? periods[0] ?? null;
}

/** Passed/total stage counts of a period (rule 2: computed, never stored). */
export function stageProgress(period: PeriodRow | null): {
  passed: number;
  total: number;
} {
  if (!period) return { passed: 0, total: 0 };
  const passed = period.stages.filter((s) =>
    PASSED_STAGE_STATUSES.includes(s.status),
  ).length;
  return { passed, total: period.stages.length };
}

/**
 * Create a case's first period + copied stages on the caller's transaction.
 * Re-exported as the cross-module seam the cases module invokes inside its
 * save transaction (rule 4 + rule 9: cases never touches the Period/CaseStage
 * tables directly).
 */
export function createRegistrationPeriodTx(
  tx: Prisma.TransactionClient,
  input: RegistrationPeriodInput,
): Promise<{ id: string }> {
  return repo.createRegistrationPeriodTx(tx, input);
}

// --- Stage engine seams (C-6 / Phase 10) ------------------------------------
// Read seams the cases service uses to authorize + validate; tx seams it runs
// inside its own $transaction (rule 4). The cases module never touches the
// Period/CaseStage tables directly (rule 9) — it goes through these.

/** A stage's current state + owning case id (from periods-owned columns). */
export async function getStageForAction(
  stageId: string,
): Promise<StageActionContext | null> {
  const r = await repo.findStageForAction(stageId);
  if (!r) return null;
  return {
    caseId: r.caseId,
    periodId: r.periodId,
    status: r.status as StageStatus,
    title: r.title,
    isExceptional: r.isExceptional,
    attemptCount: r.attemptCount,
  };
}

/** A period's owning case id + status, for an "add exceptional stage" request. */
export async function getPeriodForStageAdd(
  periodId: string,
): Promise<{ caseId: string; status: PeriodStatus } | null> {
  const r = await repo.findPeriodForAdd(periodId);
  if (!r) return null;
  return { caseId: r.caseId, status: r.status as PeriodStatus };
}

export function applyStageActionTx(
  tx: Prisma.TransactionClient,
  args: ApplyStageActionArgs,
): Promise<void> {
  return repo.applyStageActionTx(tx, args);
}

export function addExceptionalStageTx(
  tx: Prisma.TransactionClient,
  args: AddExceptionalStageArgs,
): Promise<void> {
  return repo.addExceptionalStageTx(tx, args);
}

export function deleteStageTx(
  tx: Prisma.TransactionClient,
  stageId: string,
): Promise<void> {
  return repo.deleteStageTx(tx, stageId);
}

export function moveStageTx(
  tx: Prisma.TransactionClient,
  args: MoveStageArgs,
): Promise<void> {
  return repo.moveStageTx(tx, args);
}

// --- Financial seams (C-7 / Phase 11) ---------------------------------------
// The payments module targets a period (payment "for which", adjust-total) but
// never touches the Period table directly (rule 9) — it goes through these.

/** A period's owning case id, for routing a financial request. Null if absent. */
export async function getPeriodCase(
  periodId: string,
): Promise<{ caseId: string } | null> {
  return repo.findPeriodCase(periodId);
}

/** Set a period's agreed total on the caller's transaction (adjust-total, C-7).
 *  null clears it; payments are untouched. */
export function setPeriodTotalTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  totalAmount: bigint | null,
): Promise<void> {
  return repo.setPeriodTotalTx(tx, periodId, totalAmount);
}

/** A case's active period (id + follow-up status + status), for the record-result
 *  effect-on-renewal update (C-11 / B-6). Null when there is no active period. */
export function getActivePeriod(
  caseId: string,
): Promise<{ id: string; followUpStatus: string; status: string } | null> {
  return repo.findActivePeriod(caseId);
}

/** A case's current (highest-index) period + its status, for case restore (C-8):
 *  restore reactivates it only when it is CANCELLED. Null when there is none. */
export function getCurrentPeriod(
  caseId: string,
): Promise<{ id: string; indexNumber: number; status: string } | null> {
  return repo.findCurrentPeriod(caseId);
}

/** Update a period's follow-up status (and optionally status) on the caller's
 *  transaction (record-result effect-on-renewal, B-6). */
export function setPeriodFollowUpTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  data: { followUpStatus: string; status?: string },
): Promise<void> {
  return repo.setPeriodFollowUpTx(tx, periodId, data);
}

// --- Renewal + renewals page seams (C-9 / C-10) -----------------------------
// The cases module orchestrates a renewal / abandon / restore inside its own
// save transaction (rule 4) but never touches the Period/CaseStage tables
// directly (rule 9) — it goes through these. The renewals-page view is read
// here (a Period query that joins the case's display names — a relation read
// within the periods-owned query, not a cross-module repository call).

/** The case's active period, for the renewal form: its index, expiry (→ default
 *  start) and follow-up status. Null when the case has no active period. */
export async function getRenewablePeriod(caseId: string): Promise<RenewablePeriod | null> {
  const r = await repo.findRenewablePeriod(caseId);
  if (!r) return null;
  return {
    id: r.id,
    indexNumber: r.indexNumber,
    expiryDate: dateToJalali(r.expiryDate),
    followUpStatus: r.followUpStatus as FollowUpStatus,
  };
}

/** A period's lifecycle facts for a manual abandon/restore (C-10). daysRemaining
 *  is computed here from the raw expiry (rule 2). Null when the period is absent. */
export async function getPeriodLifecycle(periodId: string): Promise<PeriodLifecycle | null> {
  const r = await repo.findPeriodLifecycle(periodId);
  if (!r) return null;
  return {
    caseId: r.caseId,
    status: r.status as PeriodStatus,
    followUpStatus: r.followUpStatus as FollowUpStatus,
    daysRemaining: daysRemainingFromDate(r.expiryDate),
    indexNumber: r.indexNumber,
  };
}

/** Renew a case on the caller's transaction (close previous → RENEWED, create the
 *  next ACTIVE period + copied renewal stages). Re-exported as the cross-module
 *  seam the cases module runs inside its save transaction (rule 4). */
export function renewPeriodTx(
  tx: Prisma.TransactionClient,
  input: RenewPeriodInput,
): Promise<{ id: string }> {
  return repo.renewPeriodTx(tx, input);
}

/** Set a period's lifecycle status (abandon/restore, C-10) on the caller's
 *  transaction (rule 4). */
export function setPeriodStatusTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  status: string,
): Promise<void> {
  return repo.setPeriodStatusTx(tx, periodId, status);
}

/**
 * The renewals work-queue for one tab (C-10). Reads every ACTIVE/ABANDONED period
 * of a non-cancelled case, computes days-remaining, the financial figures and the
 * abandon-eligibility flag at read time (rule 2 — the threshold comes from
 * settings), then keeps only the rows the tab classifies in (guards.inRenewalTab).
 * The query orders by expiry ascending, so the most urgent rows come first.
 */
export async function getRenewalsView(tab: RenewalTab): Promise<RenewalRow[]> {
  const [rows, thresholds] = await Promise.all([
    repo.findRenewalsQueue(),
    getThresholds(),
  ]);
  const now = new Date();
  return rows
    .map((r) => toRenewalRow(r, thresholds.abandonmentDays, now))
    .filter((row) =>
      inRenewalTab(tab, {
        status: row.status,
        daysRemaining: row.daysRemaining,
        followUpStatus: row.followUpStatus,
      }),
    );
}

/** Map one raw renewals-queue row to a RenewalRow, resolving days-remaining, the
 *  financial figures and abandon-eligibility at read time (rule 2). Shared by the
 *  renewals page view (getRenewalsView) and the dashboard seam
 *  (getRenewalDashboard) so both classify a period identically. */
function toRenewalRow(
  r: Awaited<ReturnType<typeof repo.findRenewalsQueue>>[number],
  abandonmentDays: number,
  now: Date,
): RenewalRow {
  const daysRemaining = daysRemainingFromDate(r.expiryDate, now);
  const total = r.totalAmount === null ? null : Number(r.totalAmount);
  const paid = r.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const status = r.status as PeriodStatus;
  const followUpStatus = r.followUpStatus as FollowUpStatus;
  return {
    periodId: r.id,
    caseId: r.case.id,
    caseNumber: r.case.number,
    customerName: customerDisplayName(r.case.customer),
    serviceName: r.case.service.name,
    ownerName: r.case.owner.fullName,
    ownerId: r.case.ownerId,
    indexNumber: r.indexNumber,
    expiryDate: dateToJalali(r.expiryDate),
    daysRemaining,
    followUpStatus,
    status,
    totalAmount: total,
    balance: total === null ? null : total - paid,
    abandonable: isAbandonable(
      { status, daysRemaining, followUpStatus },
      abandonmentDays,
    ),
  };
}

/**
 * The dashboard renewals seam (C-2). Reads the same ACTIVE/ABANDONED queue and
 * returns the "near" list (ACTIVE periods expiring within 30 days — already-
 * expired ones included, rule 2 "≤"), most-urgent first, plus the ABANDONED
 * count. `ownerId` restricts to one owner's cases (the employee dashboard);
 * null (the default) spans every owner (the manager dashboard). `now` is
 * injectable so a computed view is deterministic.
 */
export async function getRenewalDashboard(
  ownerId: string | null = null,
  now: Date = new Date(),
): Promise<{ near: RenewalRow[]; nearCount: number; abandonedCount: number }> {
  const [rows, thresholds] = await Promise.all([
    repo.findRenewalsQueue(),
    getThresholds(),
  ]);
  const mapped = rows
    .map((r) => toRenewalRow(r, thresholds.abandonmentDays, now))
    .filter((row) => (ownerId ? row.ownerId === ownerId : true));
  const near = mapped.filter(
    (row) =>
      row.status === "ACTIVE" &&
      row.daysRemaining !== null &&
      row.daysRemaining <= 30,
  );
  const abandonedCount = mapped.filter((row) => row.status === "ABANDONED").length;
  return { near, nearCount: near.length, abandonedCount };
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------
// The automatic engine reads renewal reminders, uncontacted renewals and the
// auto-abandon set through these (rule 9: the engine never touches the Period
// table directly). days-remaining is computed here from the raw expiry (rule 2)
// and `now` is injectable so a run is deterministic. Returns structural views
// (periods.types) — periods must not import engine types (DAG points downward).

/** ACTIVE periods of non-cancelled cases whose service has active reminder rules,
 *  with days-remaining + expiry resolved for the engine's reminder task. */
export async function listReminderCandidates(
  now: Date = new Date(),
): Promise<EngineReminderCandidate[]> {
  const rows = await repo.findReminderCandidates();
  return rows.map((r) => ({
    periodId: r.id,
    caseNumber: r.case.number,
    ownerId: r.case.ownerId,
    daysRemaining: daysRemainingFromDate(r.expiryDate, now),
    expiryJalali: dateToJalali(r.expiryDate),
    serviceName: r.case.service.name,
    customer: {
      type: r.case.customer.type,
      fullName: r.case.customer.fullName,
      companyName: r.case.customer.companyName,
      mobile: r.case.customer.mobile,
    },
    rules: r.case.service.reminderRules.map((rule) => ({
      id: rule.id,
      daysBefore: rule.daysBefore,
      channel: rule.channel,
      recipient: rule.recipient,
    })),
  }));
}

/** ACTIVE, not-yet-followed-up renewals with a computable days-remaining. The
 *  engine applies the ≤7-day window; here we only surface the candidates. */
export async function listUnfollowedRenewals(
  now: Date = new Date(),
): Promise<EngineUnfollowedRenewal[]> {
  const rows = await repo.findRenewalsQueue();
  const result: EngineUnfollowedRenewal[] = [];
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue;
    if (r.followUpStatus !== "NOT_FOLLOWED_UP") continue;
    const daysRemaining = daysRemainingFromDate(r.expiryDate, now);
    if (daysRemaining === null) continue;
    result.push({
      caseId: r.case.id,
      caseNumber: r.case.number,
      ownerId: r.case.ownerId,
      daysRemaining,
    });
  }
  return result;
}

/** Abandon every ACTIVE period that now meets the abandonment rule (the same
 *  isAbandonable guard the renewals page uses, with the settings threshold).
 *  NOT_INTERESTED is immediate; otherwise the period must be expired by more than
 *  the threshold. Returns the number abandoned. */
export async function abandonExpiredPeriods(now: Date = new Date()): Promise<number> {
  const [rows, thresholds] = await Promise.all([repo.findRenewalsQueue(), getThresholds()]);
  const ids = rows
    .filter((r) =>
      isAbandonable(
        {
          status: r.status as PeriodStatus,
          daysRemaining: daysRemainingFromDate(r.expiryDate, now),
          followUpStatus: r.followUpStatus as FollowUpStatus,
        },
        thresholds.abandonmentDays,
      ),
    )
    .map((r) => r.id);
  return repo.abandonPeriods(ids);
}
