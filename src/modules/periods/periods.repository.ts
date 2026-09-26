import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  RegistrationPeriodInput,
  RenewPeriodInput,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
} from "./periods.types";

// ALL Prisma access for the periods domain lives here (rule 9): Period and the
// CaseStage rows bound to a period. Called only by periods.service and, for the
// case-creation transaction, through the tx-aware seam below (invoked on the
// cases module's transaction — rule 4). No Persian text in this layer; it deals
// in ids, Date objects, and raw columns.

/**
 * Create a case's first period and copy the service's initial path stages onto
 * it, on a caller-owned transaction (rule 4). The first stage becomes
 * IN_PROGRESS (with startedAt), the rest PENDING. When there are no stages the
 * period is still created (a case with no path — B-2: no error, the path card
 * is simply not shown). indexNumber is 1 (registration).
 */
export async function createRegistrationPeriodTx(
  tx: Prisma.TransactionClient,
  input: RegistrationPeriodInput,
): Promise<{ id: string }> {
  const period = await tx.period.create({
    data: {
      caseId: input.caseId,
      indexNumber: 1,
      status: "ACTIVE",
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      totalAmount: input.totalAmount,
      followUpStatus: "NOT_FOLLOWED_UP",
    },
    select: { id: true },
  });

  if (input.stages.length > 0) {
    const now = new Date();
    await tx.caseStage.createMany({
      data: input.stages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({
          periodId: period.id,
          title: s.title,
          order: s.order,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
          startedAt: i === 0 ? now : null,
          attemptCount: 0,
          isExceptional: false,
        })),
    });
  }

  return period;
}

// --- Renewal (C-9) ----------------------------------------------------------

/**
 * Renew a case on the caller's transaction (rule 4): close the previous period
 * (→ RENEWED) and create the next one (ACTIVE, indexNumber = previous + 1) with
 * the copied renewal-path stages, the first IN_PROGRESS (with startedAt) and the
 * rest PENDING. The reminder cycle is fresh automatically — SentReminder is keyed
 * by periodId, so the new period starts with no sent rows. Case expiry is never
 * stored; it recomputes from the new active period (rule 2).
 */
export async function renewPeriodTx(
  tx: Prisma.TransactionClient,
  input: RenewPeriodInput,
): Promise<{ id: string }> {
  await tx.period.update({
    where: { id: input.previousPeriodId },
    data: { status: "RENEWED" },
  });

  const period = await tx.period.create({
    data: {
      caseId: input.caseId,
      indexNumber: input.indexNumber,
      status: "ACTIVE",
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      totalAmount: input.totalAmount,
      followUpStatus: "NOT_FOLLOWED_UP",
    },
    select: { id: true },
  });

  if (input.stages.length > 0) {
    const now = new Date();
    await tx.caseStage.createMany({
      data: input.stages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({
          periodId: period.id,
          title: s.title,
          order: s.order,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
          startedAt: i === 0 ? now : null,
          attemptCount: 0,
          isExceptional: false,
        })),
    });
  }

  return period;
}

/** Set a period's lifecycle status (abandon → ABANDONED, restore → ACTIVE) on the
 *  caller's transaction (rule 4). C-10 manual controls; the engine reuses it in
 *  Phase 15. */
export async function setPeriodStatusTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  status: string,
): Promise<void> {
  await tx.period.update({ where: { id: periodId }, data: { status } });
}

/** The case's active period, for a renewal: its index (→ next number), expiry
 *  (→ the new span's default start) and follow-up status. Null when the case has
 *  no active period. */
export async function findRenewablePeriod(caseId: string): Promise<{
  id: string;
  indexNumber: number;
  expiryDate: Date | null;
  followUpStatus: string;
} | null> {
  return prisma.period.findFirst({
    where: { caseId, status: "ACTIVE" },
    orderBy: { indexNumber: "desc" },
    select: { id: true, indexNumber: true, expiryDate: true, followUpStatus: true },
  });
}

/** A period's lifecycle facts (its owning case, status, follow-up status, expiry
 *  and index), for authorizing/validating a manual abandon or restore (C-10). The
 *  expiry is returned raw; days-remaining is computed in the service (rule 2). */
export async function findPeriodLifecycle(periodId: string): Promise<{
  caseId: string;
  status: string;
  followUpStatus: string;
  expiryDate: Date | null;
  indexNumber: number;
} | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: {
      caseId: true,
      status: true,
      followUpStatus: true,
      expiryDate: true,
      indexNumber: true,
    },
  });
}

/** The renewals work-queue (C-10): every ACTIVE or ABANDONED period of a
 *  non-cancelled case, with the joined display names + the payment amounts the
 *  balance is computed from (rule 2). The service classifies each row into a tab
 *  and computes days-remaining + the abandon-eligibility flag. */
export type RenewalQueueRow = {
  id: string;
  indexNumber: number;
  status: string;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  followUpStatus: string;
  payments: { amount: bigint }[];
  case: {
    id: string;
    number: string;
    ownerId: string;
    owner: { fullName: string };
    service: { name: string };
    customer: { type: string; fullName: string | null; companyName: string | null };
  };
};

export async function findRenewalsQueue(): Promise<RenewalQueueRow[]> {
  return prisma.period.findMany({
    where: {
      status: { in: ["ACTIVE", "ABANDONED"] },
      case: { status: { not: "CANCELLED" } },
    },
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      indexNumber: true,
      status: true,
      expiryDate: true,
      totalAmount: true,
      followUpStatus: true,
      payments: { select: { amount: true } },
      case: {
        select: {
          id: true,
          number: true,
          ownerId: true,
          owner: { select: { fullName: true } },
          service: { select: { name: true } },
          customer: { select: { type: true, fullName: true, companyName: true } },
        },
      },
    },
  });
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------
// Read/write seams the automatic engine drives through periods.service (rule 9:
// the engine never touches the Period table directly). Reading the service's
// active reminder rules via a relation-select inside this periods-owned Period
// query is a relation read (like findRenewalsQueue), not a cross-module call.

/** An ACTIVE period of a non-cancelled case whose service has ≥1 active rule,
 *  with those rules and the customer's contact details, for renewal reminders. */
export type ReminderCandidateRow = {
  id: string;
  expiryDate: Date | null;
  case: {
    number: string;
    ownerId: string;
    service: {
      name: string;
      reminderRules: { id: string; daysBefore: number; channel: string; recipient: string }[];
    };
    customer: { type: string; fullName: string | null; companyName: string | null; mobile: string };
  };
};

export async function findReminderCandidates(): Promise<ReminderCandidateRow[]> {
  return prisma.period.findMany({
    where: {
      status: "ACTIVE",
      expiryDate: { not: null },
      case: {
        status: { not: "CANCELLED" },
        service: { reminderRules: { some: { active: true } } },
      },
    },
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      expiryDate: true,
      case: {
        select: {
          number: true,
          ownerId: true,
          service: {
            select: {
              name: true,
              reminderRules: {
                where: { active: true },
                select: { id: true, daysBefore: true, channel: true, recipient: true },
              },
            },
          },
          customer: {
            select: { type: true, fullName: true, companyName: true, mobile: true },
          },
        },
      },
    },
  });
}

/** Move the given periods to ABANDONED in one statement (atomic). The engine has
 *  already decided eligibility (isAbandonable); this only writes. Returns the
 *  number of rows actually changed. */
export async function abandonPeriods(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await prisma.period.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ABANDONED" },
  });
  return res.count;
}

// --- Reads (case page shell, C-5) ------------------------------------------

export type PeriodWithDetail = {
  id: string;
  indexNumber: number;
  status: string;
  startDate: Date;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  followUpStatus: string;
  stages: {
    id: string;
    title: string;
    order: number;
    status: string;
    isExceptional: boolean;
    startedAt: Date | null;
    endedAt: Date | null;
    attemptCount: number;
    note: string | null;
    lastChangedBy: { fullName: string } | null;
  }[];
  payments: { amount: bigint }[];
};

const PERIOD_SELECT = {
  id: true,
  indexNumber: true,
  status: true,
  startDate: true,
  expiryDate: true,
  totalAmount: true,
  followUpStatus: true,
  stages: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      status: true,
      isExceptional: true,
      startedAt: true,
      endedAt: true,
      attemptCount: true,
      note: true,
      lastChangedBy: { select: { fullName: true } },
    },
  },
  payments: { select: { amount: true } },
} satisfies Prisma.PeriodSelect;

/** All periods of a case, newest first, with stages + payments for read-time
 *  computation of progress and balance (rule 2). */
export async function findPeriodsByCase(
  caseId: string,
): Promise<PeriodWithDetail[]> {
  return prisma.period.findMany({
    where: { caseId },
    orderBy: { indexNumber: "desc" },
    select: PERIOD_SELECT,
  });
}

// --- Stage engine reads (C-6) ----------------------------------------------

/** A stage's current state + its owning case id (Period.caseId — periods-owned;
 *  no Case-table join, rule 9). Null when the stage does not exist. */
export async function findStageForAction(stageId: string): Promise<{
  periodId: string;
  caseId: string;
  status: string;
  title: string;
  isExceptional: boolean;
  attemptCount: number;
} | null> {
  const row = await prisma.caseStage.findUnique({
    where: { id: stageId },
    select: {
      periodId: true,
      status: true,
      title: true,
      isExceptional: true,
      attemptCount: true,
      period: { select: { caseId: true } },
    },
  });
  if (!row) return null;
  return {
    periodId: row.periodId,
    caseId: row.period.caseId,
    status: row.status,
    title: row.title,
    isExceptional: row.isExceptional,
    attemptCount: row.attemptCount,
  };
}

/** A period's owning case id + status, for validating an "add exceptional
 *  stage" request against the current period. Null when it does not exist. */
export async function findPeriodForAdd(
  periodId: string,
): Promise<{ caseId: string; status: string } | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: { caseId: true, status: true },
  });
}

// --- Financial seams (C-7) --------------------------------------------------

/** A period's owning case id, for routing a payment/adjust-total request to the
 *  right case (authorization). Null when the period does not exist. */
export async function findPeriodCase(
  periodId: string,
): Promise<{ caseId: string } | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: { caseId: true },
  });
}

/** Set a period's agreed total on the caller's transaction (rule 4). null clears
 *  it (the card then shows "—" for balance). Payments are untouched (C-7). */
export async function setPeriodTotalTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  totalAmount: bigint | null,
): Promise<void> {
  await tx.period.update({
    where: { id: periodId },
    data: { totalAmount },
  });
}

/** A case's active period (its follow-up status + status), for the record-result
 *  effect-on-renewal update (C-11 / B-6). Null when the case has no active period. */
export async function findActivePeriod(
  caseId: string,
): Promise<{ id: string; followUpStatus: string; status: string } | null> {
  return prisma.period.findFirst({
    where: { caseId, status: "ACTIVE" },
    select: { id: true, followUpStatus: true, status: true },
    orderBy: { indexNumber: "desc" },
  });
}

/** A case's current (highest-index) period regardless of status, for case
 *  restore (C-8): the period cancelled alongside the case is the current one, so
 *  restore reactivates it only when it is CANCELLED. Null when the case has no
 *  period at all. */
export async function findCurrentPeriod(
  caseId: string,
): Promise<{ id: string; indexNumber: number; status: string } | null> {
  return prisma.period.findFirst({
    where: { caseId },
    select: { id: true, indexNumber: true, status: true },
    orderBy: { indexNumber: "desc" },
  });
}

/** Update a period's follow-up status (and optionally its status) on the caller's
 *  transaction (rule 4). Driven by the record-result effect-on-renewal mapping
 *  (B-6): "not interested" also moves the period to ABANDONED. */
export async function setPeriodFollowUpTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  data: { followUpStatus: string; status?: string },
): Promise<void> {
  await tx.period.update({
    where: { id: periodId },
    data: {
      followUpStatus: data.followUpStatus,
      ...(data.status ? { status: data.status } : {}),
    },
  });
}

// --- Stage engine writes (tx-aware, run on the cases module's transaction) --

/** Open statuses: a stage still on the path. Closed = DONE | NOT_NEEDED. */
const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "REJECTED"];

/**
 * Apply one C-6 status transition on the caller's transaction (rule 4). Done and
 * Not-Needed also advance the path: the first still-open stage by order that is
 * PENDING is auto-started (IN_PROGRESS + startedAt). Reject bumps the attempt
 * counter and keeps the stage open; Reopen clears the end time.
 */
export async function applyStageActionTx(
  tx: Prisma.TransactionClient,
  args: ApplyStageActionArgs,
): Promise<void> {
  const stage = await tx.caseStage.findUnique({
    where: { id: args.stageId },
    select: { id: true, periodId: true, startedAt: true },
  });
  if (!stage) throw new Error("stage not found");
  const now = new Date();
  const by = args.actorId;

  switch (args.op) {
    case "start":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", startedAt: stage.startedAt ?? now, lastChangedById: by },
      });
      break;
    case "done":
    case "not_needed": {
      await tx.caseStage.update({
        where: { id: stage.id },
        data: {
          status: args.op === "done" ? "DONE" : "NOT_NEEDED",
          endedAt: now,
          lastChangedById: by,
        },
      });
      // Advance: the first still-open stage by order (the just-closed one is no
      // longer open). Only a PENDING one is auto-started; a REJECTED stage that
      // is now first stays open and rejected.
      const siblings = await tx.caseStage.findMany({
        where: { periodId: stage.periodId },
        orderBy: { order: "asc" },
        select: { id: true, status: true, startedAt: true },
      });
      const next = siblings.find((s) => OPEN_STATUSES.includes(s.status));
      if (next && next.status === "PENDING") {
        await tx.caseStage.update({
          where: { id: next.id },
          data: { status: "IN_PROGRESS", startedAt: next.startedAt ?? now, lastChangedById: by },
        });
      }
      break;
    }
    case "reject":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: {
          status: "REJECTED",
          attemptCount: { increment: 1 },
          note: args.note,
          lastChangedById: by,
        },
      });
      break;
    case "reopen":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", endedAt: null, lastChangedById: by },
      });
      break;
    case "note":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { note: args.note, lastChangedById: by },
      });
      break;
  }
}

/** Append an exceptional stage to the end of a period's path (order = max + 1). */
export async function addExceptionalStageTx(
  tx: Prisma.TransactionClient,
  args: AddExceptionalStageArgs,
): Promise<void> {
  const max = await tx.caseStage.aggregate({
    where: { periodId: args.periodId },
    _max: { order: true },
  });
  await tx.caseStage.create({
    data: {
      periodId: args.periodId,
      title: args.title,
      order: (max._max.order ?? 0) + 1,
      status: "PENDING",
      attemptCount: 0,
      isExceptional: true,
      lastChangedById: args.actorId,
    },
  });
}

/** Delete a stage (only a never-acted exceptional stage reaches here — the cases
 *  service enforces that rule). */
export async function deleteStageTx(
  tx: Prisma.TransactionClient,
  stageId: string,
): Promise<void> {
  await tx.caseStage.delete({ where: { id: stageId } });
}

/** Swap a stage's order with its neighbor toward the start ("up") or end
 *  ("down"). A no-op at the edge. There is no unique constraint on
 *  (periodId, order), so a direct swap is safe. */
export async function moveStageTx(
  tx: Prisma.TransactionClient,
  args: MoveStageArgs,
): Promise<void> {
  const stage = await tx.caseStage.findUnique({
    where: { id: args.stageId },
    select: { id: true, periodId: true, order: true },
  });
  if (!stage) throw new Error("stage not found");
  const siblings = await tx.caseStage.findMany({
    where: { periodId: stage.periodId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const idx = siblings.findIndex((s) => s.id === stage.id);
  const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  await tx.caseStage.update({ where: { id: stage.id }, data: { order: other.order } });
  await tx.caseStage.update({ where: { id: other.id }, data: { order: stage.order } });
}
