import type { PaymentStatusKey } from "./payments.types";

// Pure domain rules + Persian messages for the payments module (C-7). Isomorphic
// leaf: no Prisma, no server-only imports — the client financial panel and the
// server service both use it. The status label and payment percentage are
// computed here at read time (rule 2); none of them is ever stored.

/** A user-facing financial rule failure. `field` maps the message to a form field. */
export class PaymentRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "PaymentRuleError";
    this.field = field;
  }
}

// --- Bounds (shared by the schema and any server re-check) ------------------
/** Toman is a whole number with no decimals; a single payment is capped at 2B. */
export const MAX_AMOUNT = 2_000_000_000;
/** A payment note is optional, up to 300 characters (C-7). */
export const MAX_NOTE = 300;

// --- Persian messages -------------------------------------------------------
export const AMOUNT_INVALID = "مبلغ باید بیشتر از صفر باشد.";
export const AMOUNT_TOO_LARGE = "مبلغ واردشده بیش از حد مجاز است.";
export const RECEIPT_DATE_INVALID = "تاریخ دریافت معتبر نیست.";
export const RECEIPT_DATE_FUTURE = "تاریخ دریافت نمی‌تواند در آینده باشد.";
export const METHOD_REQUIRED = "روش پرداخت را انتخاب کنید.";
export const METHOD_INVALID = "روش پرداخت انتخاب‌شده معتبر نیست.";
export const PERIOD_REQUIRED = "مشخص کنید این مبلغ برای کدام دوره است.";
export const PERIOD_INVALID = "دورهٔ انتخاب‌شده معتبر نیست.";
export const NOTE_TOO_LONG = "حداکثر ۳۰۰ نویسه مجاز است.";
export const PAYMENT_NOT_FOUND = "پرداخت یافت نشد.";
export const FINANCIAL_FORBIDDEN = "شما مجاز به این اقدام نیستید.";

/**
 * The C-7 status label of a period, computed from its (agreed) total and the
 * sum of its payments (rule 2 — never stored). An empty total means nothing was
 * agreed: any money received reads as a prepayment, otherwise unpaid. A total of
 * zero is settled at zero paid and overpaid once anything is received.
 */
export function paymentStatus(total: number | null, paid: number): PaymentStatusKey {
  if (total === null) return paid > 0 ? "prepayment" : "unpaid";
  if (paid === 0) return total === 0 ? "settled" : "unpaid";
  if (paid < total) return "prepayment";
  if (paid === total) return "settled";
  return "overpaid"; // paid > total — allowed, shown in the warning color (C-7)
}

/**
 * Paid ÷ total as a whole percent, or null when there is no total to divide by
 * (empty or zero) — the card shows "—" then. Overpayment can exceed 100%.
 */
export function paymentPercent(total: number | null, paid: number): number | null {
  if (total === null || total === 0) return null;
  return Math.round((paid / total) * 100);
}
