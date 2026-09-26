import type { Prisma } from "@prisma/client";
import { toJalali, formatJalali } from "@/lib/jalali";
import type { PeriodStatus, FollowUpStatus, StageStatus } from "@/types/enums";
import * as repo from "./periods.repository";
import type {
  PeriodRow,
  StageRow,
  RegistrationPeriodInput,
  StageActionContext,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
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
