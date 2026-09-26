import type { PeriodStatus, FollowUpStatus, StageStatus } from "@/types/enums";

// Presentation labels for the periods module (Persian UI text lives here, never
// in the repository). Isomorphic leaf: safe to import from client components.

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  ACTIVE: "فعال",
  RENEWED: "تمدیدشده",
  CANCELLED: "لغوشده",
  ABANDONED: "رهاشده",
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
