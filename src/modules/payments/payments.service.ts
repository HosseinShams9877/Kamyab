import { parseJalali, toGregorianDate, toJalali, formatJalali } from "@/lib/jalali";
import { can, type Authorizable } from "@/modules/permissions";
import { getCaseOwnership, runCaseMutation } from "@/modules/cases";
import { getPeriodCase, getPeriodsForCase, setPeriodTotalTx } from "@/modules/periods";
import { listListItems } from "@/modules/settings";
import * as repo from "./payments.repository";
import { paymentPeriodLabel } from "./lib/labels";
import {
  METHOD_INVALID,
  PERIOD_INVALID,
  PAYMENT_NOT_FOUND,
  FINANCIAL_FORBIDDEN,
} from "./payments.guards";
import type { PaymentCreateInput, AdjustTotalInput } from "./payments.schema";
import type {
  CaseFinancial,
  PaymentRow,
  PaymentMethodOption,
  PaymentPeriodOption,
} from "./payments.types";

// Business logic for the payments domain (C-7 financial card). The service is the
// module's only cross-module entry point (rule 9): the case's ownership/status +
// the shared case-mutation transaction come from @/modules/cases, the period a
// payment targets from @/modules/periods, and the active payment methods from
// @/modules/settings. Every financial write runs through the cases transaction so
// the payment/period-total write, the case's last-activity bump, and the history
// record are one atomic step (rule 4). Authorization is record-scoped (rule 3):
// viewing needs `financial.view`; recording/deleting needs `financial.record_payment`
// AND `cases.edit` on the case; adjusting the total needs `financial.adjust_total`
// AND `cases.edit`. Financial actions are NOT blocked on a cancelled case (C-7 has
// no such block; a manager may still correct money after cancellation, C-8).

// --- Authorization (record-scoped, mirrors canEditStages) -------------------

/** May the user see the financial card at all? */
export function canViewFinancial(user: Authorizable): boolean {
  return can(user, "financial.view");
}

/** May the user record or delete a payment on this case? */
export function canRecordPayments(user: Authorizable, ownerId: string): boolean {
  return can(user, "financial.record_payment") && can(user, "cases.edit", { ownerId });
}

/** May the user adjust this case's period total? */
export function canAdjustTotal(user: Authorizable, ownerId: string): boolean {
  return can(user, "financial.adjust_total") && can(user, "cases.edit", { ownerId });
}

// --- Reads (case page Financial card + Payments tab) ------------------------

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date): string {
  return formatJalali(toJalali(date), { persianDigits: false });
}

/** The active payment methods, as pick-list options (settings seam, rule 9). */
export async function listPaymentMethodOptions(): Promise<PaymentMethodOption[]> {
  const items = await listListItems("paymentMethods");
  return items
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, title: m.title }));
}

/**
 * Everything the case page's Financial card + Payments tab needs (C-7): the
 * payment list (newest first), the active methods, and the case's periods for
 * the "for which" picker. Paid/balance/label/percent are computed by the page +
 * the pure guards from these rows (rule 2) — none is read from a stored column.
 */
export async function getCaseFinancial(caseId: string): Promise<CaseFinancial> {
  const [rows, methods, periods] = await Promise.all([
    repo.findPaymentsByCase(caseId),
    listPaymentMethodOptions(),
    getPeriodsForCase(caseId),
  ]);

  const payments: PaymentRow[] = rows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    receiptDate: dateToJalali(p.receiptDate),
    methodTitle: p.method.title,
    note: p.note,
    recordedByName: p.recordedBy.fullName,
    periodId: p.periodId,
    periodIndex: p.period.indexNumber,
  }));

  const periodOptions: PaymentPeriodOption[] = periods.map((pd) => ({
    id: pd.id,
    indexNumber: pd.indexNumber,
    label: paymentPeriodLabel(pd.indexNumber),
  }));

  return { payments, methods, periods: periodOptions };
}

// --- Writes (C-7 buttons: record / adjust total / delete) -------------------

type FinancialResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409; message: string };

/**
 * Record a payment (C-7). Routes the request to the case via the target period,
 * authorizes (record-scoped), checks the method is an active settings method,
 * then inserts the payment + the case's last-activity bump + history in one
 * transaction (rule 4). Paid/balance/label update on the next read (never stored).
 */
export async function recordPayment(
  user: Authorizable,
  input: PaymentCreateInput,
): Promise<FinancialResult> {
  const period = await getPeriodCase(input.periodId);
  if (!period) return { ok: false, code: 404, message: PERIOD_INVALID };
  const kase = await getCaseOwnership(period.caseId);
  if (!kase) return { ok: false, code: 404, message: PERIOD_INVALID };

  if (!canRecordPayments(user, kase.ownerId)) {
    return { ok: false, code: 403, message: FINANCIAL_FORBIDDEN };
  }

  const methods = await listPaymentMethodOptions();
  if (!methods.some((m) => m.id === input.methodId)) {
    return { ok: false, code: 409, message: METHOD_INVALID };
  }

  const j = parseJalali(input.receiptDate);
  if (!j) return { ok: false, code: 409, message: PERIOD_INVALID };
  const receiptDate = toGregorianDate(j);
  const note = input.note && input.note.trim() ? input.note.trim() : null;

  await runCaseMutation({
    caseId: period.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) =>
      repo.createPaymentTx(tx, {
        periodId: input.periodId,
        amount: BigInt(input.amount),
        receiptDate,
        methodId: input.methodId,
        note,
        recordedById: user.id,
      }),
    historyAction: "payment.recorded",
    historyDetail: JSON.stringify({
      periodId: input.periodId,
      amount: input.amount,
      methodId: input.methodId,
      receiptDate: input.receiptDate,
    }),
  });
  return { ok: true };
}

/**
 * Delete a payment (C-7). Confirmation is a client concern; here the delete is
 * authorized (record-scoped) and recorded in history (who, how much, when) in
 * one transaction (rule 4).
 */
export async function deletePayment(
  user: Authorizable,
  paymentId: string,
): Promise<FinancialResult> {
  const payment = await repo.findPaymentForAction(paymentId);
  if (!payment) return { ok: false, code: 404, message: PAYMENT_NOT_FOUND };
  const kase = await getCaseOwnership(payment.caseId);
  if (!kase) return { ok: false, code: 404, message: PAYMENT_NOT_FOUND };

  if (!canRecordPayments(user, kase.ownerId)) {
    return { ok: false, code: 403, message: FINANCIAL_FORBIDDEN };
  }

  await runCaseMutation({
    caseId: payment.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => repo.deletePaymentTx(tx, paymentId),
    historyAction: "payment.deleted",
    historyDetail: JSON.stringify({
      paymentId,
      periodId: payment.periodId,
      amount: Number(payment.amount),
    }),
  });
  return { ok: true };
}

/**
 * Adjust a period's agreed total (C-7): changes only that period's total, never
 * its payments. Authorized separately from recording (`financial.adjust_total`),
 * written in one transaction with the case's last-activity bump + history.
 */
export async function adjustTotal(
  user: Authorizable,
  input: AdjustTotalInput,
): Promise<FinancialResult> {
  const period = await getPeriodCase(input.periodId);
  if (!period) return { ok: false, code: 404, message: PERIOD_INVALID };
  const kase = await getCaseOwnership(period.caseId);
  if (!kase) return { ok: false, code: 404, message: PERIOD_INVALID };

  if (!canAdjustTotal(user, kase.ownerId)) {
    return { ok: false, code: 403, message: FINANCIAL_FORBIDDEN };
  }

  const total = input.totalAmount === null ? null : BigInt(input.totalAmount);
  await runCaseMutation({
    caseId: period.caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: (tx) => setPeriodTotalTx(tx, input.periodId, total),
    historyAction: "period.total_adjusted",
    historyDetail: JSON.stringify({
      periodId: input.periodId,
      totalAmount: input.totalAmount,
    }),
  });
  return { ok: true };
}
