import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali } from "@/lib/jalali";
import { FollowUpStatus } from "@/types/enums.schema";
import type { FollowUpStatus as FollowUpStatusValue } from "@/types/enums";
import {
  NOTE_MAX,
  START_DATE_INVALID,
  NOTE_TOO_LONG,
  AMOUNT_INVALID,
  AMOUNT_TOO_LARGE,
  FOLLOW_UP_STATUS_REQUIRED,
  FOLLOW_UP_STATUS_INVALID,
} from "./periods.guards";

// Shared validation for the periods domain (C-9 renewal + renewal follow-up).
// The SAME objects validate in the browser (the renewal / follow-up forms) and
// on the server (the renewal API routes), so a hand-crafted request cannot bypass
// a rule the form enforces (rule 3). Isomorphic leaf: everything it imports
// (digits, jalali, the enum values, the guard messages) is client-safe. Whether
// the case is renewable / has an active period / the duration exists are business
// rules the cases service owns (the schema does not know the DB).

/** A required id selected from a pick list / carried by the form. */
const caseId = z.string().trim().min(1);

/** Required Jalali "YYYY/MM/DD" start date for the new period. Digits are
 *  normalized to ASCII so the server always stores a canonical date. Unlike case
 *  registration a renewal start MAY be in the future (you schedule the next span);
 *  it only has to be a real date. */
const startDate = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => parseJalali(v) !== null, { message: START_DATE_INVALID });

/** Optional renewal amount in whole Toman (0 .. 2,000,000,000). Empty → null. */
const renewalAmount = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || /^\d+$/.test(v), { message: AMOUNT_INVALID })
  .refine((v) => v === "" || Number(v) <= 2_000_000_000, { message: AMOUNT_TOO_LARGE })
  .transform((v) => (v === "" ? null : Number(v)));

/** Optional note, ≤ 300 characters (C-9). Empty → "". */
const note = z
  .string()
  .trim()
  .max(NOTE_MAX, { message: NOTE_TOO_LONG })
  .optional()
  .or(z.literal(""));

/** Mandatory follow-up status, one of the five renewal-status values (C-9). A
 *  missing/blank value is a "required" error; an unknown value is "invalid". */
const followUpStatus = z
  .string()
  .trim()
  .min(1, { message: FOLLOW_UP_STATUS_REQUIRED })
  .refine((v) => (FollowUpStatus.options as readonly string[]).includes(v), {
    message: FOLLOW_UP_STATUS_INVALID,
  })
  .transform((v) => v as FollowUpStatusValue);

/**
 * Register a renewal (C-9). `durationId` is optional at the schema level; the
 * cases service requires it for the (always renewable) case being renewed and
 * checks it against the service's active durations — the schema does not know
 * them. The computed expiry is derived server-side from the start date + the
 * duration's month count (never sent by the client).
 */
export const renewalSchema = z.object({
  caseId,
  startDate,
  durationId: z.string().trim().optional().or(z.literal("")),
  renewalAmount,
  note,
});
export type RenewalInput = z.infer<typeof renewalSchema>;

/** Record a renewal follow-up (C-9): the mandatory follow-up status + an optional
 *  note. Kept separate from the expiry status (which is computed from the date). */
export const renewalFollowUpSchema = z.object({
  caseId,
  followUpStatus,
  note,
});
export type RenewalFollowUpInput = z.infer<typeof renewalFollowUpSchema>;

/** A period-targeted lifecycle action (abandon / restore, C-10). */
export const periodActionSchema = z.object({
  periodId: z.string().trim().min(1),
});
export type PeriodActionInput = z.infer<typeof periodActionSchema>;
