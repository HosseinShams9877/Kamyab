import type { RenewalEffect, FollowUpStatus, PeriodStatus } from "@/types/enums";

// Pure domain rules + Persian messages for the followups domain (C-11 / B-6).
// Isomorphic leaf: no Prisma, no server-only imports — the client record-result
// form and the server service both use it. The effect-on-renewal → period mapping
// (B-6) keys off the stored `effectOnRenewal` value, never the result's title.

/** A user-facing follow-up rule failure. `field` maps the message to a form field. */
export class FollowUpRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "FollowUpRuleError";
    this.field = field;
  }
}

// --- Bounds -----------------------------------------------------------------
export const NOTE_MAX = 500;
export const NEXT_TITLE_MIN = 2;
export const NEXT_TITLE_MAX = 150;

// --- Persian messages -------------------------------------------------------
export const RESULT_REQUIRED = "نتیجهٔ پیگیری را انتخاب کنید.";
export const RESULT_INVALID = "نتیجهٔ انتخاب‌شده معتبر نیست.";
export const NOTE_TOO_LONG = "حداکثر ۵۰۰ نویسه مجاز است.";
export const NEXT_TITLE_INVALID = "عنوان کار بعدی باید بین ۲ تا ۱۵۰ نویسه باشد.";
export const NEXT_DATE_REQUIRED = "برای کار بعدی، تاریخ سررسید را وارد کنید.";
export const NEXT_DATE_INVALID = "تاریخ سررسید کار بعدی معتبر نیست.";
export const TASK_NOT_FOUND = "کار یافت نشد.";
export const TASK_FORBIDDEN = "شما مجاز به ثبت نتیجه برای این کار نیستید.";
export const TASK_ALREADY_CLOSED = "برای این کار قبلاً نتیجه ثبت شده است.";
export const TASK_NEEDS_CASE =
  "ثبت نتیجه فقط برای کاری ممکن است که به یک پرونده متصل باشد.";

/**
 * How a follow-up result's effect-on-renewal changes the case's active period
 * (B-6). `AGREES_TO_RENEW` marks the period's follow-up status accordingly;
 * `NOT_INTERESTED` also abandons the period ("منصرف؛ بدون انتظار به بایگانی").
 * `NONE` leaves the period untouched. Returns null when there is nothing to do.
 */
export function periodEffect(
  effect: RenewalEffect,
): { followUpStatus: FollowUpStatus; status?: PeriodStatus } | null {
  if (effect === "AGREES_TO_RENEW") return { followUpStatus: "AGREES_TO_RENEW" };
  if (effect === "NOT_INTERESTED") {
    return { followUpStatus: "NOT_INTERESTED", status: "ABANDONED" };
  }
  return null;
}
