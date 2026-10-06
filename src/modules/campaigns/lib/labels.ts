import type { CampaignChannel, CampaignStatus, RecipientStatus } from "@/types/enums";

export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannel, string> = {
  SMS: "پیامک",
  INTERNAL_NOTIFICATION: "اعلان داخلی",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "پیش‌نویس",
  SCHEDULED: "زمان‌بندی‌شده",
  RUNNING: "در حال اجرا",
  COMPLETED: "پایان‌یافته",
  CANCELLED: "لغوشده",
};

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = {
  DRAFT: "bg-disabled-bg text-disabled",
  SCHEDULED: "bg-info-bg text-info",
  RUNNING: "bg-warning-bg text-warning",
  COMPLETED: "bg-success-bg text-success",
  CANCELLED: "bg-error-bg text-error",
};

export const RECIPIENT_STATUS_LABELS: Record<RecipientStatus, string> = {
  QUEUED: "در صف",
  SENT: "ارسال‌شده",
  FAILED: "ناموفق",
  SKIPPED: "ردشده",
};

export const RECIPIENT_STATUS_BADGE: Record<RecipientStatus, string> = {
  QUEUED: "bg-info-bg text-info",
  SENT: "bg-success-bg text-success",
  FAILED: "bg-error-bg text-error",
  SKIPPED: "bg-disabled-bg text-disabled",
};