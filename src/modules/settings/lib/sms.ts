// Pure SMS-template helpers (B-10): placeholder catalog, template rendering with
// unknown-placeholder passthrough, and Persian-aware SMS part counting. No
// server dependencies — imported by the template editor (client) and by tests.

import { toPersianDigits } from "@/lib/digits";

/** The placeholders a template may contain, with a Persian label + sample. */
export const SMS_PLACEHOLDERS: {
  token: string;
  label: string;
  sample: string;
}[] = [
  { token: "customerName", label: "نام مشتری", sample: "علی رضایی" },
  { token: "companyName", label: "نام شرکت", sample: "شرکت نمونه" },
  { token: "serviceName", label: "نام خدمت", sample: "کارت بازرگانی" },
  { token: "expiryDate", label: "تاریخ انقضا", sample: "۱۴۰۶/۰۷/۰۱" },
  { token: "daysRemaining", label: "روزهای باقی‌مانده", sample: "۷" },
  { token: "caseNumber", label: "شماره پرونده", sample: "۱۴۰۵-۰۲۸۴" },
  {
    token: "instituteName",
    label: "نام موسسه",
    sample: "موسسه حقوقی ثبت کامیاب",
  },
  { token: "amount", label: "مبلغ", sample: "۷٬۵۰۰٬۰۰۰" },
];

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/**
 * Replace `{token}` occurrences with the matching value. An unknown token is
 * left exactly as written (B-10: never crash, never blank an unknown field).
 */
export function renderTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(PLACEHOLDER_RE, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token)
      ? values[token]
      : match,
  );
}

/** Sample values keyed by token, for the live preview. */
export const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  SMS_PLACEHOLDERS.map((p) => [p.token, p.sample]),
);

/** Render a template against the sample data for the preview panel. */
export function renderPreview(body: string): string {
  return renderTemplate(body, SAMPLE_VALUES);
}

export function smsCharCount(text: string): number {
  return [...text].length;
}

/**
 * Number of SMS segments for a Persian (non-GSM, UCS-2) message: a single part
 * holds 70 characters, concatenated parts hold 67 each.
 */
export function smsPartCount(text: string): number {
  const len = smsCharCount(text);
  if (len === 0) return 0;
  if (len <= 70) return 1;
  return Math.ceil(len / 67);
}

/** Persian-digit rendering of the char/part counts for display. */
export function smsCountLabel(text: string): string {
  const chars = toPersianDigits(String(smsCharCount(text)));
  const parts = toPersianDigits(String(smsPartCount(text)));
  return `${chars} نویسه • ${parts} پیامک`;
}
