import { toPersianDigits } from "@/lib/digits";
import type {
  TaskPriorityKey,
  TaskStatusKey,
  TaskTab,
} from "../tasks.types";

// Presentation-only labels + badge classes for the tasks domain (C-11).
// Isomorphic leaf (client-safe): the task panel imports this directly, never
// the barrel. Persian UI text lives here; the logic keys off the stored English
// enum value, never the label.

export const TASK_PRIORITY_LABELS: Record<TaskPriorityKey, string> = {
  NORMAL: "عادی",
  HIGH: "متوسط",
  URGENT: "زیاد",
};

export const TASK_PRIORITY_BADGE: Record<TaskPriorityKey, string> = {
  NORMAL: "bg-disabled-bg text-disabled",
  HIGH: "bg-info-bg text-info",
  URGENT: "bg-error-bg text-error",
};

export const TASK_STATUS_LABELS: Record<TaskStatusKey, string> = {
  OPEN: "باز",
  COMPLETED: "انجام‌شده",
  CANCELLED: "لغوشده",
};

export const TASK_TAB_LABELS: Record<TaskTab, string> = {
  all: "همهٔ کارها",
  today: "امروز",
  overdue: "عقب‌افتاده",
  mine: "کارهای من",
  assigned: "واگذارشده به دیگران",
  completed: "انجام‌شده",
  archive: "بایگانی",
};

/** The "N days late" / "due in N days" caption for a task row (Persian digits). */
export function dueCaption(daysFromToday: number): string {
  if (daysFromToday === 0) return "سررسید امروز";
  if (daysFromToday < 0)
    return `${toPersianDigits(String(Math.abs(daysFromToday)))} روز گذشته`;
  return `${toPersianDigits(String(daysFromToday))} روز مانده`;
}