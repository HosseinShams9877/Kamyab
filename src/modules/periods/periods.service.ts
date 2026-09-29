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
  RenewalStats,
  RenewalListParams,
  StageActionContext,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
  EngineReminderCandidate,
  EngineUnfollowedRenewal,
} from "./periods.types";

// Business logic for the periods domain. Jalali<->Date conversion and the
// read-time financial computation (rule 2) live here; the repository stays a
// thin DB layer.

const PASSED_STAGE_STATUSES = ["DONE", "NOT_NEEDED"];

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date | null): string | null {
  if (!date) return null;
  return formatJalali(toJalali(date), { persianDigits: false });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysRemainingFromDate(expiry: Date | null, now: Date = new Date()): number | null {
  if (!expiry) return null;
  const e = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((e.getTime() - today.getTime()) / DAY_MS);
}

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

export async function getPeriodsForCase(caseId: string): Promise<PeriodRow[]> {
  const rows = await repo.findPeriodsByCase(caseId);
  return rows.map(mapPeriod);
}

export function currentPeriod(periods: PeriodRow[]): PeriodRow | null {
  return periods.find((p) => p.status === "ACTIVE") ?? periods[0] ?? null;
}

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

export function createRegistrationPeriodTx(
  tx: Prisma.TransactionClient,
  input: RegistrationPeriodInput,
): Promise<{ id: string }> {
  return repo.createRegistrationPeriodTx(tx, input);
}

// --- Stage engine seams (C-6 / Phase 10) ------------------------------------

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

export async function getPeriodCase(
  periodId: string,
): Promise<{ caseId: string } | null> {
  return repo.findPeriodCase(periodId);
}

export function setPeriodTotalTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  totalAmount: bigint | null,
): Promise<void> {
  return repo.setPeriodTotalTx(tx, periodId, totalAmount);
}

export function getActivePeriod(
  caseId: string,
): Promise<{ id: string; followUpStatus: string; status: string } | null> {
  return repo.findActivePeriod(caseId);
}

export function getCurrentPeriod(
  caseId: string,
): Promise<{ id: string; indexNumber: number; status: string } | null> {
  return repo.findCurrentPeriod(caseId);
}

export function setPeriodFollowUpTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  data: { followUpStatus: string; status?: string },
): Promise<void> {
  return repo.setPeriodFollowUpTx(tx, periodId, data);
}

// --- Renewal + renewals page seams (C-9 / C-10) -----------------------------

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

export function renewPeriodTx(
  tx: Prisma.TransactionClient,
  input: RenewPeriodInput,
): Promise<{ id: string }> {
  return repo.renewPeriodTx(tx, input);
}

export function setPeriodStatusTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  status: string,
): Promise<void> {
  return repo.setPeriodStatusTx(tx, periodId, status);
}

/**
 * The renewals work-queue for one tab (C-10), with optional filters. Reads every
 * ACTIVE/ABANDONED/RENEWED period of a non-cancelled case, computes
 * days-remaining + the abandon-eligibility flag at read time (rule 2), keeps only
 * the rows the tab classifies in, then applies the user-facing filters (search,
 * service, owner, follow-up status). The query orders by expiry ascending.
 */
export async function getRenewalsView(
  tab: RenewalTab,
  params: RenewalListParams = {},
): Promise<RenewalRow[]> {
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
    )
    .filter((row) => !params.ownerId || row.ownerId === params.ownerId)
    .filter((row) => !params.serviceId || row.serviceName === params.serviceId)
    .filter(
      (row) => !params.followUpStatus || row.followUpStatus === params.followUpStatus,
    )
    .filter((row) => {
      if (!params.q || !params.q.trim()) return true;
      const q = params.q.trim();
      return (
        row.customerName.includes(q) ||
        row.customerMobile.includes(q) ||
        row.caseNumber.includes(q)
      );
    });
}

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
    customerMobile: r.case.customer.mobile,
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

/** The four headline stats above the renewals table (C-10). When `ownerId` is
 *  given, the counts are scoped to that employee's cases (C-15 employee panel). */

export async function getRenewalStats(ownerId?: string): Promise<RenewalStats> {
  const rows = await repo.findRenewalsQueue();
  const now = new Date();
  let expired = 0;
  let within7 = 0;
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue;
    if (ownerId && r.case.ownerId !== ownerId) continue;
    const d = daysRemainingFromDate(r.expiryDate, now);
    if (d === null) continue;
    if (d < 0) expired += 1;
    else if (d <= 7) within7 += 1;
  }
  return { expired, within7 };
}

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