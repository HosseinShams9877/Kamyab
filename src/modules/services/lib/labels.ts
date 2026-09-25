// Presentation data for the services module: Persian labels for reminder-rule
// enums (B-4). Pure and isomorphic — safe to import from client components.
// Rule 3: used by this module only, so it lives in the module's own lib/ folder.

import type { ReminderChannel, ReminderRecipient } from "@/types/enums";
import { toPersianDigits } from "@/lib/digits";

/** How a reminder is delivered (B-4). */
export const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = {
  INTERNAL_NOTIFICATION: "اعلان داخلی",
  SMS_TO_CUSTOMER: "پیامک به مشتری",
};

export const REMINDER_CHANNEL_OPTIONS: {
  value: ReminderChannel;
  label: string;
}[] = [
  { value: "INTERNAL_NOTIFICATION", label: REMINDER_CHANNEL_LABELS.INTERNAL_NOTIFICATION },
  { value: "SMS_TO_CUSTOMER", label: REMINDER_CHANNEL_LABELS.SMS_TO_CUSTOMER },
];

/** Who receives a reminder (B-4). */
export const REMINDER_RECIPIENT_LABELS: Record<ReminderRecipient, string> = {
  CASE_OWNER: "مسئول پرونده",
  ALL_MANAGERS: "همه مدیران",
  CUSTOMER: "مشتری",
};

export const REMINDER_RECIPIENT_OPTIONS: {
  value: ReminderRecipient;
  label: string;
}[] = [
  { value: "CASE_OWNER", label: REMINDER_RECIPIENT_LABELS.CASE_OWNER },
  { value: "ALL_MANAGERS", label: REMINDER_RECIPIENT_LABELS.ALL_MANAGERS },
  { value: "CUSTOMER", label: REMINDER_RECIPIENT_LABELS.CUSTOMER },
];

/**
 * Human phrasing for a daysBefore value (B-4): positive = before expiry, zero =
 * on the expiry day, negative = after. The number is shown in Persian digits.
 */
export function daysBeforeLabel(daysBefore: number): string {
  const n = toPersianDigits(String(Math.abs(daysBefore)));
  if (daysBefore > 0) return `${n} روز قبل از انقضا`;
  if (daysBefore === 0) return "روز انقضا";
  return `${n} روز بعد از انقضا`;
}
