import type { z } from "zod";
import type {
  Role,
  CustomerType,
  CaseStatus,
  StageStatus,
  PeriodStatus,
  FollowUpStatus,
  TaskPriority,
  TaskStatus,
  PathType,
  ReminderChannel,
  ReminderRecipient,
  RenewalEffect,
  SmsStatus,
} from "./enums.schema";

// Single source for the fixed-enum union types, inferred from the Zod schemas
// so the values live in exactly one place (src/types/enums.schema.ts).

export type Role = z.infer<typeof Role>;
export type CustomerType = z.infer<typeof CustomerType>;
export type CaseStatus = z.infer<typeof CaseStatus>;
export type StageStatus = z.infer<typeof StageStatus>;
export type PeriodStatus = z.infer<typeof PeriodStatus>;
export type FollowUpStatus = z.infer<typeof FollowUpStatus>;
export type TaskPriority = z.infer<typeof TaskPriority>;
export type TaskStatus = z.infer<typeof TaskStatus>;
export type PathType = z.infer<typeof PathType>;
export type ReminderChannel = z.infer<typeof ReminderChannel>;
export type ReminderRecipient = z.infer<typeof ReminderRecipient>;
export type RenewalEffect = z.infer<typeof RenewalEffect>;
export type SmsStatus = z.infer<typeof SmsStatus>;
