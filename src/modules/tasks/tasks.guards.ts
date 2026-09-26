import type { JalaliDate } from "@/lib/jalali";
import { compareJalali } from "@/lib/jalali";
import type { TaskStatusKey } from "./tasks.types";

// Pure domain rules + Persian messages for the tasks domain (C-11). Isomorphic
// leaf: no Prisma, no server-only imports — the client task panel and the server
// service both use it. "Overdue" is computed here (rule 2), never stored.

/** A user-facing task rule failure. `field` maps the message to a form field. */
export class TaskRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "TaskRuleError";
    this.field = field;
  }
}

// --- Bounds -----------------------------------------------------------------
export const TITLE_MIN = 2;
export const TITLE_MAX = 150;
export const NOTE_MAX = 500;

// --- Persian messages -------------------------------------------------------
export const TITLE_REQUIRED = "عنوان کار باید بین ۲ تا ۱۵۰ نویسه باشد.";
export const DUE_DATE_INVALID = "تاریخ سررسید معتبر نیست.";
export const OWNER_REQUIRED = "مسئول کار را انتخاب کنید.";
export const PRIORITY_INVALID = "اولویت انتخاب‌شده معتبر نیست.";
export const NOTE_TOO_LONG = "حداکثر ۵۰۰ نویسه مجاز است.";
export const CASE_INVALID = "پروندهٔ انتخاب‌شده معتبر نیست.";
export const OWNER_INACTIVE = "کار را نمی‌توان به کارمند غیرفعال واگذار کرد.";
export const TASK_NOT_FOUND = "کار یافت نشد.";
export const TASK_FORBIDDEN = "شما مجاز به این اقدام نیستید.";
export const TASK_HAS_FOLLOWUP =
  "این کار یک پیگیری ثبت‌شده دارد و فقط بایگانی می‌شود.";
export const ALREADY_ARCHIVED = "این کار قبلاً بایگانی شده است.";
export const NOT_ARCHIVED = "این کار بایگانی نشده است.";

/**
 * Whether an open task is past its due date (C-11 — computed live, never stored).
 * A task counts as overdue only while it is OPEN and not archived; its due date
 * is compared in the Jalali calendar against today.
 */
export function isOverdue(
  due: JalaliDate,
  today: JalaliDate,
  status: TaskStatusKey,
  archived: boolean,
): boolean {
  if (status !== "OPEN" || archived) return false;
  return compareJalali(due, today) < 0;
}
