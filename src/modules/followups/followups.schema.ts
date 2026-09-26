import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali } from "@/lib/jalali";
import {
  NOTE_MAX,
  NEXT_TITLE_MIN,
  NEXT_TITLE_MAX,
  RESULT_REQUIRED,
  NOTE_TOO_LONG,
  NEXT_TITLE_INVALID,
  NEXT_DATE_REQUIRED,
  NEXT_DATE_INVALID,
} from "./followups.guards";

// Shared validation for the record-result action (C-11 / B-6). The SAME object
// validates in the browser (the record-result form) and on the server (the API
// route), so a hand-crafted request cannot bypass a rule the form enforces
// (rule 3). Isomorphic leaf. Whether the result id / task / case actually exist
// and are valid is a business rule the service owns (the schema does not know DB).

/** Optional note, ≤ 500 characters. Empty → "". */
const note = z
  .string()
  .trim()
  .max(NOTE_MAX, { message: NOTE_TOO_LONG })
  .optional()
  .or(z.literal(""));

/** Optional Jalali "YYYY/MM/DD" for the next task; validated real only when set. */
const optionalJalali = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .optional()
  .or(z.literal(""));

/**
 * Record a follow-up result (C-11): the result is mandatory; the note is optional
 * (≤500). "next task" is an optional continuation — when checked it needs a valid
 * due date (and an optional title, 2–150; the service falls back to the closed
 * task's title when omitted).
 */
export const recordResultSchema = z
  .object({
    resultId: z.string().trim().min(1, { message: RESULT_REQUIRED }),
    note,
    nextTask: z.boolean().optional(),
    nextTaskTitle: z
      .string()
      .trim()
      .min(NEXT_TITLE_MIN, { message: NEXT_TITLE_INVALID })
      .max(NEXT_TITLE_MAX, { message: NEXT_TITLE_INVALID })
      .optional()
      .or(z.literal("")),
    nextTaskDueDate: optionalJalali,
  })
  .superRefine((val, ctx) => {
    if (!val.nextTask) return;
    const raw = val.nextTaskDueDate?.trim() ?? "";
    if (!raw) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nextTaskDueDate"], message: NEXT_DATE_REQUIRED });
      return;
    }
    if (parseJalali(raw) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nextTaskDueDate"], message: NEXT_DATE_INVALID });
    }
  });

export type RecordResultInput = z.infer<typeof recordResultSchema>;
