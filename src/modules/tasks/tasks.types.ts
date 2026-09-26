import type { TaskPriority, TaskStatus } from "@/types/enums";

// Isomorphic types for the tasks domain (C-11). No Prisma, no server-only
// imports — shared by the service, the API routes, and the client task panel.

export type TaskPriorityKey = TaskPriority; // NORMAL | HIGH | URGENT
export type TaskStatusKey = TaskStatus; // OPEN | COMPLETED | CANCELLED

/** The seven views of the tasks page (C-11). "overdue" is computed, never stored. */
export type TaskTab =
  | "all"
  | "today"
  | "overdue"
  | "mine"
  | "assigned"
  | "completed"
  | "archive";

export const TASK_TABS: TaskTab[] = [
  "all",
  "today",
  "overdue",
  "mine",
  "assigned",
  "completed",
  "archive",
];

/** A task as shown in a list (Jalali date strings; overdue + hasFollowUp are
 *  computed at read time — rule 2). */
export type TaskRow = {
  id: string;
  title: string;
  caseId: string | null;
  caseNumber: string | null;
  ownerId: string;
  ownerName: string;
  dueDate: string; // Jalali YYYY/MM/DD
  priority: TaskPriorityKey;
  status: TaskStatusKey;
  note: string | null;
  overdue: boolean;
  hasFollowUp: boolean;
  archivedAt: string | null; // Jalali or null
  createdById: string;
  createdByName: string;
};

/** An active employee, for the owner picker. */
export type TaskOwnerOption = { id: string; fullName: string };

/** An active case, for the related-case picker. */
export type TaskCaseOption = { id: string; number: string; label: string };

/** Everything the task form needs to render its two pickers. */
export type TaskFormData = {
  owners: TaskOwnerOption[];
  cases: TaskCaseOption[];
  currentUserId: string;
};
