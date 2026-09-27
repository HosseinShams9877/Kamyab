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

// Shared validation for the tasks domain (C-11).

/** Task title, 2–150 characters. */
const title = z
  .string()
  .trim()
  .min(TITLE_MIN, { message: TITLE_REQUIRED })
  .max(TITLE_MAX, { message: TITLE_REQUIRED });

/** Required Jalali "YYYY/MM/DD" due date that must be a real date. */
const dueDate = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => parseJalali(v) !== null, { message: DUE_DATE_INVALID });

/** Optional time of day, "HH:MM" or "". */
const dueTime = z
  .string()
  .trim()
  .regex(/^\d{1,2}:\d{2}$/, { message: "ساعت معتبر نیست." })
  .optional()
  .or(z.literal(""));

/** Optional note, ≤ 500 characters. Empty → "". */
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

/** Create/edit a task (C-11). `caseId` is optional; `ownerId` is required. */
export const taskCreateSchema = z.object({
  title,
  caseId: z.string().trim().optional().or(z.literal("")),
  ownerId: z.string().trim().min(1, { message: OWNER_REQUIRED }),
  dueDate,
  dueTime,
  priority,
  note,
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

/** Edit an existing task — same shape as create. */
export const taskUpdateSchema = taskCreateSchema;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;