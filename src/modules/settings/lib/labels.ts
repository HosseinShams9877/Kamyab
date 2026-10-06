// Presentation data for the settings module (Persian labels, provider list).
// Pure and isomorphic — safe to import from client components. Rule 3: used by
// this module only, so it lives in the module's own lib/ folder.

import type { ListKind } from "../settings.types";
import type { RenewalEffect } from "@/types/enums";

/** Section heading + empty-state hint for each managed list. */
export const LIST_LABELS: Record<
  ListKind,
  { title: string; addLabel: string }
> = {
  departments: { title: "دپارتمان‌ها", addLabel: "افزودن دپارتمان" },
  categories: { title: "دسته‌بندی خدمات", addLabel: "افزودن دسته‌بندی" },
  paymentMethods: { title: "روش‌های پرداخت", addLabel: "افزودن روش پرداخت" },
  cancellationReasons: {
    title: "دلایل انصراف",
    addLabel: "افزودن دلیل انصراف",
  },
  followUpResults: {
    title: "نتایج پیگیری",
    addLabel: "افزودن نتیجه پیگیری",
  },
};

/** Effect-on-renewal labels for the follow-up-results list (B-6). */
export const RENEWAL_EFFECT_LABELS: Record<RenewalEffect, string> = {
  NONE: "بدون اثر",
  AGREES_TO_RENEW: "موافق تمدید",
  NOT_INTERESTED: "منصرف از تمدید",
};

export const RENEWAL_EFFECT_OPTIONS: { value: RenewalEffect; label: string }[] =
  [
    { value: "NONE", label: RENEWAL_EFFECT_LABELS.NONE },
    { value: "AGREES_TO_RENEW", label: RENEWAL_EFFECT_LABELS.AGREES_TO_RENEW },
    { value: "NOT_INTERESTED", label: RENEWAL_EFFECT_LABELS.NOT_INTERESTED },
  ];

/** Supported SMS providers (B-10). Values are stable keys; labels are Persian. */
export const SMS_PROVIDERS: { value: string; label: string }[] = [
  { value: "kavenegar", label: "کاوه‌نگار" },
  { value: "melipayamak", label: "ملی‌پیامک" },
  { value: "ghasedak", label: "قاصدک" },
];

/** Persian labels for the known SMS event templates (B-10). */
export const SMS_EVENT_LABELS: Record<string, string> = {
  renewal_reminder: "یادآوری تمدید",
  birthday_natural: "تبریک تولد (شخص حقیقی)",
  birthday_legal: "تبریک سالروز تأسیس (شخص حقوقی)",
  campaign_general: "کمپین پیامکی",
};

export function smsEventLabel(eventKey: string): string {
  return SMS_EVENT_LABELS[eventKey] ?? eventKey;
}
