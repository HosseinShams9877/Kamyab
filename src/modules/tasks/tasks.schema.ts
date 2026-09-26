import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali } from "@/lib/jalali";
import { TaskPriority } from "@/types/enums.schema";
import {
  TITLE_MIN,
  TITLE_MAX,
  NOTE_MAX,
  TITLE_REQUIRED,
  DUE_DATE_INVALID,
  OWNER_REQUIRED,
  PRIORITY_INVALID,
  NOTE_TOO_LONG,
} from "./tasks.guards";

// Shared validation for the tasks domain (C-11). The SAME objects validate in
// the browser (the task form) and on the server (the task API routes), so a
// hand-crafted request cannot bypass a rule the form enforces (rule 3).
// Isomorphic leaf: everything it imports (digits, jalali, enums, guards) is
// client-safe. Whether a case/owner id actually exists and is active is a
// business rule the service owns (the schema does not know the DB).

/** Task title, 2–150 characters (C-11). */
const title = z
  .string()
  .trim()
  .min(TITLE_MIN, { message: TITLE_REQUIRED })
  .max(TITLE_MAX, { message: TITLE_REQUIRED });

/** Required Jalali "YYYY/MM/DD" due date that must be a real date. Digits are
 *  normalized to ASCII so the server always stores a canonical date. A due date
 *  may be in the past (you can log a task that is already late). */
const dueDate = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => parseJalali(v) !== null, { message: DUE_DATE_INVALID });

/** Optional note, ≤ 500 characters (C-11). Empty → "". */
const note = z
  .string()
  .trim()
  .max(NOTE_MAX, { message: NOTE_TOO_LONG })
  .optional()
  .or(z.literal(""));

const priority = TaskPriority.catch("NORMAL" as const).refine(
  (v) => v === "NORMAL" || v === "HIGH" || v === "URGENT",
  { message: PRIORITY_INVALID },
);

/** Create/edit a task (C-11). `caseId` is optional (a task need not belong to a
 *  case); when omitted the form sends "". `ownerId` is required — the form
 *  defaults it to the current user. */
export const taskCreateSchema = z.object({
  title,
  caseId: z.string().trim().optional().or(z.literal("")),
  ownerId: z.string().trim().min(1, { message: OWNER_REQUIRED }),
  dueDate,
  priority,
  note,
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

/** Edit an existing task — same shape as create; the service authorizes by
 *  ownership and rejects an inactive new owner. */
export const taskUpdateSchema = taskCreateSchema;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
