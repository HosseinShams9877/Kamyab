import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for the payments domain lives here (rule 9): the Payment
// table — its reads (the case's payment list, one payment's routing row) and its
// tx-aware writes (create / delete), run on the cases module's transaction so a
// payment write, the case's last-activity bump, and the history record are one
// atomic step (rule 4). No Persian text in this layer; it deals in ids, Date
// objects, and raw columns. The joined method title + recorder name are the
// Payment row's own relations. The period-balance rollup is NOT here — periods
// owns that read-time aggregate (payments depends on periods, never the reverse).

export type PaymentDetailRow = {
  id: string;
  amount: bigint;
  receiptDate: Date;
  note: string | null;
  periodId: string;
  period: { indexNumber: number };
  method: { title: string };
  recordedBy: { fullName: string };
};

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  receiptDate: true,
  note: true,
  periodId: true,
  period: { select: { indexNumber: true } },
  method: { select: { title: true } },
  recordedBy: { select: { fullName: true } },
} satisfies Prisma.PaymentSelect;

/** Every payment of a case (across its periods), newest receipt first. */
export async function findPaymentsByCase(
  caseId: string,
): Promise<PaymentDetailRow[]> {
  return prisma.payment.findMany({
    where: { period: { caseId } },
    orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
    select: PAYMENT_SELECT,
  });
}

/** A payment's routing row: its amount + the owning period and case, for the
 *  delete path (authorization + history). Null when the payment does not exist. */
export async function findPaymentForAction(
  paymentId: string,
): Promise<{ id: string; amount: bigint; periodId: string; caseId: string } | null> {
  const row = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      periodId: true,
      period: { select: { caseId: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    amount: row.amount,
    periodId: row.periodId,
    caseId: row.period.caseId,
  };
}

// --- Writes (tx-aware, run on the cases module's transaction) ---------------

export type CreatePaymentTxArgs = {
  periodId: string;
  amount: bigint;
  receiptDate: Date;
  methodId: string;
  note: string | null;
  recordedById: string;
};

/** Insert a payment on the caller's transaction (rule 4). */
export async function createPaymentTx(
  tx: Prisma.TransactionClient,
  args: CreatePaymentTxArgs,
): Promise<void> {
  await tx.payment.create({
    data: {
      periodId: args.periodId,
      amount: args.amount,
      receiptDate: args.receiptDate,
      methodId: args.methodId,
      note: args.note,
      recordedById: args.recordedById,
    },
  });
}

/** Delete a payment on the caller's transaction (rule 4). */
export async function deletePaymentTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<void> {
  await tx.payment.delete({ where: { id: paymentId } });
}
