// Pure rules + Persian error messages for the campaigns module (isomorphic).

export const CAMPAIGN_FORBIDDEN = "شما مجاز به این اقدام روی کمپین نیستید.";
export const CAMPAIGN_NOT_FOUND = "کمپین یافت نشد.";
export const CAMPAIGN_NOT_EDITABLE = "این کمپین قابل ویرایش نیست.";
export const CAMPAIGN_NOT_SENDABLE = "این کمپین در وضعیت قابل ارسال نیست.";
export const CAMPAIGN_NO_RECIPIENTS =
  "هیچ مشتری‌ای با این فیلتر پیدا نشد. کمپین ارسال نشد.";
export const SMS_TEMPLATE_REQUIRED = "برای کمپین پیامکی، انتخاب قالب الزامی است.";
export const INTERNAL_BODY_REQUIRED = "برای کمپین اعلان داخلی، متن پیام الزامی است.";
export const CAMPAIGN_ALREADY_RUNNING = "این کمپین در حال اجراست.";
export const CAMPAIGN_FINISHED = "این کمپین پایان یافته یا لغو شده است.";

/** The statuses in which a campaign can still be edited. */
const EDITABLE_STATUSES = ["DRAFT", "SCHEDULED"];

export function isCampaignEditable(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** The statuses a campaign can be sent from. */
const SENDABLE_STATUSES = ["DRAFT", "SCHEDULED"];

export function isCampaignSendable(status: string): boolean {
  return SENDABLE_STATUSES.includes(status);
}