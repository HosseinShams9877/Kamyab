import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  RegistrationPeriodInput,
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
