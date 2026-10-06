// Types for the settings domain (C-13, section B). The Setting store is a
// key → JSON-serialized string map (a String column, for SQLite/PostgreSQL
// parity), so these describe the shapes the repository reads and the service
// returns. The five manager-defined lists are real TABLES (Department,
// ServiceCategory, PaymentMethod, CancellationReason, FollowUpResult) sharing a
// uniform shape, exposed here through a single ListItem type keyed by ListKind.

import type { RenewalEffect } from "@/types/enums";

/** A single raw Setting row as stored (value is a JSON-serialized string). */
export type SettingRow = {
  key: string;
  value: string;
};

/**
 * Well-known setting keys used across the app (all stored in the key-value
 * Setting table). Grouped by settings section for readability.
 */
export type SettingKey =
  // Institute information (B-10)
  | "institute_name"
  | "institute_phone"
  | "institute_address"
  | "institute_email"
  // Time thresholds (B-8)
  | "threshold_archive_days"
  | "threshold_abandonment_days"
  | "threshold_stale_days"
  // Birthday greeting (B-9)
  | "birthday_greeting_enabled"
  | "birthday_send_hour"
  // SMS gateway (B-10)
  | "sms_provider"
  | "sms_api_key"
  | "sms_sender_number"
  | "sms_real_send"
  // Stage-due reminders (تب تنظیمات مراحل)
  | "stage_reminder_enabled"
  | "stage_reminder_days"
  | "stage_reminder_channels"
  | "stage_reminder_recipients"
  | "stage_auto_prompt"
  | "stage_notification_template"
  | "stage_sms_template";

// ---------------------------------------------------------------------------
// Editable manager-defined lists (B-5, B-6, B-7)
// ---------------------------------------------------------------------------

/** The five editable lists managed on the settings page. */
export const LIST_KINDS = [
  "departments",
  "categories",
  "paymentMethods",
  "cancellationReasons",
  "followUpResults",
] as const;

export type ListKind = (typeof LIST_KINDS)[number];

/**
 * One row of a manager-defined list. `effectOnRenewal` is present only for
 * follow-up results (B-6). `usageCount` is how many records reference the item —
 * an item used anywhere can only be deactivated, never deleted (B-7).
 */
export type ListItem = {
  id: string;
  title: string;
  active: boolean;
  order: number;
  effectOnRenewal?: RenewalEffect;
  usageCount: number;
};

// ---------------------------------------------------------------------------
// Settings-group value shapes (parsed from the key-value store)
// ---------------------------------------------------------------------------

export type InstituteInfo = {
  name: string;
  phone: string;
  address: string;
  email: string;
};

export type Thresholds = {
  archiveDays: number;
  abandonmentDays: number;
  staleDays: number;
};

export type BirthdaySettings = {
  enabled: boolean;
  sendHour: number;
};

/** Gateway config as returned to the client — the API key is NEVER echoed. */
export type GatewayView = {
  provider: string;
  senderNumber: string;
  realSend: boolean;
  hasApiKey: boolean;
};

export type SmsTemplateRow = {
  eventKey: string;
  body: string;
};

export type SmsFailure = {
  id: string;
  recipient: string;
  templateKey: string;
  error: string | null;
  createdAt: Date;
};

export type SmsStatusView = {
  sent: number;
  queued: number;
  failed: number;
  recentFailures: SmsFailure[];
};