import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for the followups domain lives here (rule 9): the FollowUp
// table. A follow-up is immutable (B-6) — there is no update/delete here; a
// mistake is corrected by recording another follow-up, and both stay in the
// timeline. The write is tx-aware only: it always runs inside the record-result
// transaction owned by the cases module (Case.lastActivityAt + ActivityHistory).

/** The data a follow-up write needs. taskId/periodId are optional FKs. */
export type FollowUpWriteData = {
  taskId: string | null;
  caseId: string;
  periodId: string | null;
  resultId: string;
  note: string | null;
  createdById: string;
};

/** Create a follow-up on the caller's transaction (rule 4). */
export async function createFollowUpTx(
  tx: Prisma.TransactionClient,
  data: FollowUpWriteData,
): Promise<void> {
  await tx.followUp.create({
    data: {
      taskId: data.taskId,
      caseId: data.caseId,
      periodId: data.periodId,
      resultId: data.resultId,
      note: data.note,
      createdById: data.createdById,
    },
  });
}

// Joined shape for a follow-up timeline row.
const FOLLOWUP_SELECT = {
  id: true,
  note: true,
  createdAt: true,
  result: { select: { title: true, effectOnRenewal: true } },
  task: { select: { title: true } },
  createdBy: { select: { fullName: true } },
} satisfies Prisma.FollowUpSelect;

export type FollowUpRecord = Prisma.FollowUpGetPayload<{ select: typeof FOLLOWUP_SELECT }>;

/** A case's follow-ups, newest first (the case-page Tasks/timeline tab). */
export function findFollowUpsByCase(caseId: string): Promise<FollowUpRecord[]> {
  return prisma.followUp.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    select: FOLLOWUP_SELECT,
  });
}

// Joined shape for the "last follow-up" line on a period card (C-9): who + when
// + note, keyed by the period the follow-up was recorded against.
const PERIOD_FOLLOWUP_SELECT = {
  periodId: true,
  note: true,
  createdAt: true,
  createdBy: { select: { fullName: true } },
} satisfies Prisma.FollowUpSelect;

export type PeriodFollowUpRecord = Prisma.FollowUpGetPayload<{
  select: typeof PERIOD_FOLLOWUP_SELECT;
}>;

/** A case's period-scoped follow-ups (periodId set), newest first — the service
 *  keeps the first per period for the "last follow-up" card line (C-9). */
export function findFollowUpsWithPeriod(caseId: string): Promise<PeriodFollowUpRecord[]> {
  return prisma.followUp.findMany({
    where: { caseId, periodId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: PERIOD_FOLLOWUP_SELECT,
  });
}
