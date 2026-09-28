import type { PeriodStatus, FollowUpStatus, StageStatus } from "@/types/enums";
import type { RenewalTab } from "../periods.guards";

// Presentation labels for the periods module (Persian UI text lives here, never
// in the repository). Isomorphic leaf: safe to import from client components.

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  ACTIVE: "فعال",
  RENEWED: "تمدیدشده",
  CANCELLED: "لغوشده",
  ABANDONED: "رهاشده",
};

/** Badge tone (background + text token pair) for each period status (C-9 cards). */
export const PERIOD_STATUS_BADGE: Record<PeriodStatus, string> = {
  ACTIVE: "bg-success-bg text-success",
  RENEWED: "bg-info-bg text-info",
  CANCELLED: "bg-disabled-bg text-disabled",
  ABANDONED: "bg-error-bg text-error",
};

/** Badge tone for each follow-up status (C-9 cards / renewals table). */
export const FOLLOW_UP_STATUS_BADGE: Record<FollowUpStatus, string> = {
  NOT_FOLLOWED_UP: "bg-disabled-bg text-disabled",
  CONTACTED: "bg-info-bg text-info",
  AWAITING_CUSTOMER: "bg-warning-bg text-warning",
  AGREES_TO_RENEW: "bg-success-bg text-success",
  NOT_INTERESTED: "bg-error-bg text-error",
};

/** The renewals work-queue tab labels (C-10). */
export const RENEWAL_TAB_LABELS: Record<RenewalTab, string> = {
  all: "همه تمدیدها",
  urgent: "فوری",
  near: "نزدیک به تمدید",
  expired: "منقضی‌شده",
  no_followup: "بدون پیگیری",
  renewed: "تمدیدشده",
  abandoned: "رهاشده",
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  PENDING: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام‌شده",
  REJECTED: "رد‌شده",
  NOT_NEEDED: "نیازی نیست",
};

/** Badge tone (background + text token pair) for each stage status. */
export const STAGE_STATUS_BADGE: Record<StageStatus, string> = {
  PENDING: "bg-disabled-bg text-disabled",
  IN_PROGRESS: "bg-warning-bg text-warning",
  DONE: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
  NOT_NEEDED: "bg-info-bg text-info",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  NOT_FOLLOWED_UP: "پیگیری‌نشده",
  CONTACTED: "تماس‌گرفته‌شده",
  AWAITING_CUSTOMER: "در انتظار مشتری",
  AGREES_TO_RENEW: "موافق تمدید",
  NOT_INTERESTED: "منصرف",
};

/** The title of a period's path card (C-5): registration vs a numbered renewal. */
export function periodPathTitle(indexNumber: number): string {
  return indexNumber <= 1 ? "مسیر ثبت اولیه" : `مسیر تمدید — دورهٔ ${indexNumber}`;
}