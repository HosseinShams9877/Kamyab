import { z } from "zod";

// The deliberately-fixed value sets from docs/roadmap/database-schema.md.
// These are NOT manager-editable and NOT Prisma enums (SQLite has no enums):
// every such column is a String in the schema and validated here with Zod.
// The manager-editable lists (departments, categories, methods, reasons,
// results) are database TABLES, not enums (Principle 1).

export const Role = z.enum(["MANAGER", "SUPERVISOR", "EMPLOYEE"]);
export const CustomerType = z.enum(["NATURAL", "LEGAL"]);
export const CaseStatus = z.enum([
  "NEW",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export const StageStatus = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
  "NOT_NEEDED",
]);
export const PeriodStatus = z.enum([
  "ACTIVE",
  "RENEWED",
  "CANCELLED",
  "ABANDONED",
]);
export const FollowUpStatus = z.enum([
  "NOT_FOLLOWED_UP",
  "CONTACTED",
  "AWAITING_CUSTOMER",
  "AGREES_TO_RENEW",
  "NOT_INTERESTED",
]);
export const TaskPriority = z.enum(["NORMAL", "HIGH", "URGENT"]);
export const TaskStatus = z.enum(["OPEN", "COMPLETED", "CANCELLED"]);
export const PathType = z.enum(["INITIAL", "RENEWAL"]);
export const ReminderChannel = z.enum([
  "INTERNAL_NOTIFICATION",
  "SMS_TO_CUSTOMER",
]);
export const ReminderRecipient = z.enum([
  "CASE_OWNER",
  "ALL_MANAGERS",
  "CUSTOMER",
]);
export const RenewalEffect = z.enum([
  "NONE",
  "AGREES_TO_RENEW",
  "NOT_INTERESTED",
]);

// SMS message lifecycle (SmsMessage.status). Not in the schema-doc enum table
// but a fixed set the engine relies on.
export const SmsStatus = z.enum(["QUEUED", "SENT", "FAILED"]);
