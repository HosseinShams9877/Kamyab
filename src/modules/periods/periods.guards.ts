import type { FollowUpStatus, PeriodStatus } from "@/types/enums";

// Pure domain rules + Persian messages for the periods module (C-9 renewal, C-10
// renewals page + abandonment). Isomorphic leaf: no Prisma, no server-only
// imports — the client renewal forms / renewals table and the server service both
// use it. The abandonment condition and the renewals-tab classification live here
// (one place, rule 2 — computed from the date, never stored) so the same rule is
// applied client-side (button visibility, tab membership) and server-side (the
// real gate).

/** A user-facing period rule failure. `field` maps the message to a form field. */
export class PeriodRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "PeriodRuleError";
    this.field = field;
  }
}

// --- Bounds -----------------------------------------------------------------
export const NOTE_MAX = 300;

// --- Persian rule messages --------------------------------------------------
export const START_DATE_INVALID = "تاریخ شروع دورهٔ جدید معتبر نیست.";
export const DURATION_REQUIRED = "انتخاب مدت اعتبار الزامی است.";
export const DURATION_INVALID = "مدت اعتبار انتخاب‌شده معتبر نیست.";
export const NO_DURATION_DEFINED = "برای این خدمت مدت اعتباری تعریف نشده است.";
export const AMOUNT_INVALID = "مبلغ باید عددی باشد.";
export const AMOUNT_TOO_LARGE = "مبلغ واردشده بیش از حد مجاز است.";
export const NOTE_TOO_LONG = "حداکثر ۳۰۰ نویسه مجاز است.";
export const FOLLOW_UP_STATUS_REQUIRED = "وضعیت پیگیری را انتخاب کنید.";
export const FOLLOW_UP_STATUS_INVALID = "وضعیت پیگیری انتخاب‌شده معتبر نیست.";

export const RENEWAL_FORBIDDEN = "شما مجاز به این اقدام نیستید.";
export const CASE_NOT_FOUND = "پرونده یافت نشد.";
export const CASE_CANCELLED = "پروندهٔ لغوشده تمدید نمی‌شود.";
export const SERVICE_NOT_RENEWABLE = "این خدمت قابل تمدید نیست.";
export const NO_ACTIVE_PERIOD = "دورهٔ فعالی برای تمدید این پرونده وجود ندارد.";
export const PERIOD_NOT_FOUND = "دوره یافت نشد.";
export const NOT_ABANDONABLE =
  "این دوره هنوز شرایط رهاشدن را ندارد (باید منقضی و از آستانهٔ رهاسازی گذشته باشد، یا وضعیت پیگیری «منصرف» باشد).";
export const NOT_ABANDONED = "این دوره در وضعیت رهاشده نیست.";

// --- Renewals-page tabs (C-10) ----------------------------------------------

/** The renewals work-queue tabs (C-10). */
export type RenewalTab =
  | "all"
  | "urgent"
  | "near"
  | "expired"
  | "no_followup"
  | "renewed"
  | "abandoned";

export const RENEWAL_TABS: RenewalTab[] = [
  "all",
  "urgent",
  "near",
  "expired",
  "no_followup",
  "renewed",
  "abandoned",
];

/** Windows (in days) that define the tabs (C-10). */
export const ALL_WINDOW = 90;
export const URGENT_MAX = 7;
export const NEAR_MIN = 8;
export const NEAR_MAX = 30;
export const NO_FOLLOWUP_WINDOW = 30;

/** The fields the classification + abandonment rules read (all computed, rule 2). */
export type RenewalFacts = {
  status: PeriodStatus;
  daysRemaining: number | null;
  followUpStatus: FollowUpStatus;
};

export function daysSinceExpiry(daysRemaining: number | null): number | null {
  return daysRemaining === null ? null : -daysRemaining;
}

export function isAbandonable(
  facts: RenewalFacts,
  abandonmentDays: number,
): boolean {
  if (facts.status !== "ACTIVE") return false;
  if (facts.daysRemaining === null) return false;
  if (facts.daysRemaining >= 0) return false;
  if (facts.followUpStatus === "NOT_INTERESTED") return true;
  return -facts.daysRemaining > abandonmentDays;
}

/**
 * Whether a period belongs in a given renewals tab (C-10). `abandoned` and
 * `renewed` are independent of days-remaining (real status transitions); every
 * other tab shows only ACTIVE periods with an expiry, classified by
 * days-remaining.
 */
export function inRenewalTab(tab: RenewalTab, facts: RenewalFacts): boolean {
  if (tab === "abandoned") return facts.status === "ABANDONED";
  if (tab === "renewed") return facts.status === "RENEWED";

  // Main tabs: an active, dated period only.
  if (facts.status !== "ACTIVE") return false;
  const d = facts.daysRemaining;
  if (d === null) return false;

  switch (tab) {
    case "all":
      return d <= ALL_WINDOW;
    case "urgent":
      return d >= 0 && d <= URGENT_MAX;
    case "near":
      return d >= NEAR_MIN && d <= NEAR_MAX;
    case "expired":
      return d < 0;
    case "no_followup":
      return d <= NO_FOLLOWUP_WINDOW && facts.followUpStatus === "NOT_FOLLOWED_UP";
    default:
      return false;
  }
}