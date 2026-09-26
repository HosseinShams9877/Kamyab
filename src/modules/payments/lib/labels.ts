import { toPersianDigits } from "@/lib/digits";
import type { PaymentStatusKey } from "../payments.types";

// Presentation labels for the payments module (Persian UI text lives here, never
// in the repository). Isomorphic leaf: safe to import from client components.

/** The four computed C-7 status labels. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatusKey, string> = {
  unpaid: "پرداخت نشده",
  prepayment: "پیش‌پرداخت دریافت شد",
  settled: "تسویه شده",
  overpaid: "اضافه پرداخت",
};

/** Badge tone (background + text token pair) for each status. Overpaid uses the
 *  warning color per C-7. */
export const PAYMENT_STATUS_BADGE: Record<PaymentStatusKey, string> = {
  unpaid: "bg-disabled-bg text-disabled",
  prepayment: "bg-info-bg text-info",
  settled: "bg-success-bg text-success",
  overpaid: "bg-warning-bg text-warning",
};

/** The period label shown in the "for which" picker and the payment list. */
export function paymentPeriodLabel(indexNumber: number): string {
  return indexNumber <= 1
    ? "دورهٔ ثبت اولیه"
    : `دورهٔ ${toPersianDigits(String(indexNumber))}`;
}
