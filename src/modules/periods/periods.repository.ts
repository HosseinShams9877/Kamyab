import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RegistrationPeriodInput } from "./periods.types";

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
