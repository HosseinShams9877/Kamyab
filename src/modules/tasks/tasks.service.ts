import type { Prisma } from "@prisma/client";
import { parseJalali, toGregorianDate, toJalali, formatJalali, todayJalali } from "@/lib/jalali";
import { can, scopeByOwnership, type Authorizable } from "@/modules/permissions";
import { listActiveCaseOptions } from "@/modules/cases";
import { listCaseOwnerOptions } from "@/modules/employees";
import * as repo from "./tasks.repository";
import { isOverdue } from "./tasks.guards";
import {
  OWNER_INACTIVE,
  OWNER_REQUIRED,
  CASE_INVALID,
  TASK_NOT_FOUND,
  TASK_FORBIDDEN,
  TASK_HAS_FOLLOWUP,
  ALREADY_ARCHIVED,
  NOT_ARCHIVED,
  DUE_DATE_INVALID,
} from "./tasks.guards";
import type { TaskCreateInput, TaskUpdateInput } from "./tasks.schema";
import type {
  TaskRow,
  TaskTab,
  TaskFormData,
  TaskPriorityKey,
  TaskStatusKey,
} from "./tasks.types";

// Business logic for the tasks domain (C-11). The service is the module's only
// cross-module entry point (rule 9): active-case options come from @/modules/cases,
// active-employee options from @/modules/employees. Authorization is server-side
// and record-scoped (rule 3): editing/reassigning/recording/archiving/deleting all
// go through `can(user, key, { ownerId })`, so an employee without `tasks.view_all`
// may act only on tasks they own — this is what stops one employee editing another's
// task. "Overdue" is computed at read time from the due date (rule 2), never stored.
//
// This module never imports @/modules/followups: reading a task's OWN follow-up
// count is the Task relation, and the record-result transaction is orchestrated by
// the followups service, which injects the tx-aware seams re-exported at the bottom
// of this file. That keeps the module DAG acyclic (tasks -> {cases, employees}).

/** A task write/action result the API routes map to an HTTP status. */
export type TaskResult =
  | { ok: true; id?: string }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

// --- Authorization (record-scoped, rule 3) ---------------------------------

/** May the user create tasks at all? */
export function canCreateTask(user: Authorizable): boolean {
  return can(user, "tasks.create");
}

/** May the user assign a task to someone other than themselves? */
export function canAssignTasks(user: Authorizable): boolean {
  return can(user, "tasks.assign");
}

/** May the user edit this task? Create permission + ownership scope: without
 *  `tasks.view_all` the owner must be the user themselves. */
export function canEditTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.create", { ownerId });
}

/** May the user record a result on this task? */
export function canRecordResult(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.record_result", { ownerId });
}

/** May the user archive/unarchive this task? */
export function canArchiveTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.archive", { ownerId });
}

/** May the user delete this task? (No-follow-up rule is enforced separately.) */
export function canDeleteTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.delete", { ownerId });
}

// --- Reads ------------------------------------------------------------------

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date): string {
  return formatJalali(toJalali(date), { persianDigits: false });
}

/** Everything the task form needs: active owners, active cases, current user. */
export async function getTaskFormData(user: Authorizable): Promise<TaskFormData> {
  const [owners, cases] = await Promise.all([
    listCaseOwnerOptions(),
    listActiveCaseOptions(),
  ]);
  return { owners, cases, currentUserId: user.id };
}

/** Map a stored task row to the client view, computing `overdue` + `hasFollowUp`
 *  live (rule 2) and rendering dates as ASCII Jalali. */
function toRow(r: repo.TaskRecord, today: ReturnType<typeof todayJalali>): TaskRow {
  const status = r.status as TaskStatusKey;
  const archived = r.archivedAt !== null;
  return {
    id: r.id,
    title: r.title,
    caseId: r.caseId,
    caseNumber: r.case?.number ?? null,
    ownerId: r.ownerId,
    ownerName: r.owner.fullName,
    dueDate: dateToJalali(r.dueDate),
    priority: r.priority as TaskPriorityKey,
    status,
    note: r.note,
    overdue: isOverdue(toJalali(r.dueDate), today, status, archived),
    hasFollowUp: r._count.followUps > 0,
    archivedAt: archived ? dateToJalali(r.archivedAt as Date) : null,
    createdById: r.createdById,
    createdByName: r.createdBy.fullName,
  };
}

/**
 * The task rows for one of the seven tabs (C-11), ownership-scoped (rule 3).
 * "today" / "overdue" compare against local-midnight day boundaries derived from
 * today's Jalali date. "mine" and "assigned" key off the current user directly
 * (a user always sees tasks they own or created), so they ignore the view scope.
 */
export async function getTasksView(user: Authorizable, tab: TaskTab): Promise<TaskRow[]> {
  const scope = scopeByOwnership(user, "tasks");
  if (scope === null) return [];

  const todayJ = todayJalali();
  const todayStart = toGregorianDate(todayJ);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  let where: Prisma.TaskWhereInput;
  switch (tab) {
    case "today":
      where = { ...scope, status: "OPEN", archivedAt: null, dueDate: { gte: todayStart, lt: tomorrowStart } };
      break;
    case "overdue":
      where = { ...scope, status: "OPEN", archivedAt: null, dueDate: { lt: todayStart } };
      break;
    case "mine":
      where = { status: "OPEN", archivedAt: null, ownerId: user.id };
      break;
    case "assigned":
      where = { archivedAt: null, createdById: user.id, ownerId: { not: user.id } };
      break;
    case "completed":
      where = { ...scope, status: "COMPLETED", archivedAt: null };
      break;
    case "archive":
      where = { ...scope, archivedAt: { not: null } };
      break;
    case "all":
    default:
      where = { ...scope, status: "OPEN", archivedAt: null };
      break;
  }

  const rows = await repo.findTasks(where);
  return rows.map((r) => toRow(r, todayJ));
}

// --- Writes (create / update / archive / delete) ----------------------------

/** Validate the owner (must be active), the case (must exist and be active), and
 *  the due date, converting the write into repository shape. Shared by create +
 *  update so a hand-crafted request cannot bypass a rule the form enforces. */
async function resolveWrite(
  input: TaskCreateInput,
): Promise<
  | { ok: true; caseId: string | null; ownerId: string; dueDate: Date; priority: string; note: string | null }
  | { ok: false; code: 409 | 422; message: string }
> {
  if (!input.ownerId) return { ok: false, code: 422, message: OWNER_REQUIRED };

  const owners = await listCaseOwnerOptions();
  if (!owners.some((o) => o.id === input.ownerId)) {
    return { ok: false, code: 409, message: OWNER_INACTIVE };
  }

  let caseId: string | null = null;
  if (input.caseId && input.caseId.trim()) {
    const cases = await listActiveCaseOptions();
    if (!cases.some((c) => c.id === input.caseId)) {
      return { ok: false, code: 409, message: CASE_INVALID };
    }
    caseId = input.caseId;
  }

  const j = parseJalali(input.dueDate);
  if (!j) return { ok: false, code: 422, message: DUE_DATE_INVALID };

  const note = input.note && input.note.trim() ? input.note.trim() : null;
  return { ok: true, caseId, ownerId: input.ownerId, dueDate: toGregorianDate(j), priority: input.priority, note };
}

export async function createTask(user: Authorizable, input: TaskCreateInput): Promise<TaskResult> {
  if (!canCreateTask(user)) return { ok: false, code: 403, message: TASK_FORBIDDEN };
  // Assigning to someone else needs the assign permission (C-11).
  if (input.ownerId !== user.id && !canAssignTasks(user)) {
    return { ok: false, code: 403, message: TASK_FORBIDDEN };
  }

  const resolved = await resolveWrite(input);
  if (!resolved.ok) return resolved;

  const { id } = await repo.createTask({
    title: input.title,
    caseId: resolved.caseId,
    ownerId: resolved.ownerId,
    dueDate: resolved.dueDate,
    priority: resolved.priority,
    note: resolved.note,
    createdById: user.id,
  });
  return { ok: true, id };
}

export async function updateTask(
  user: Authorizable,
  taskId: string,
  input: TaskUpdateInput,
): Promise<TaskResult> {
  const task = await repo.findTaskForAction(taskId);
  if (!task) return { ok: false, code: 404, message: TASK_NOT_FOUND };
  if (!canEditTask(user, task.ownerId)) return { ok: false, code: 403, message: TASK_FORBIDDEN };
  // Reassigning to someone else needs the assign permission (C-11).
  if (input.ownerId !== user.id && input.ownerId !== task.ownerId && !canAssignTasks(user)) {
    return { ok: false, code: 403, message: TASK_FORBIDDEN };
  }

  const resolved = await resolveWrite(input);
  if (!resolved.ok) return resolved;

  await repo.updateTask(taskId, {
    title: input.title,
    caseId: resolved.caseId,
    ownerId: resolved.ownerId,
    dueDate: resolved.dueDate,
    priority: resolved.priority,
    note: resolved.note,
  });
  return { ok: true, id: taskId };
}

export async function setTaskArchived(
  user: Authorizable,
  taskId: string,
  archived: boolean,
): Promise<TaskResult> {
  const task = await repo.findTaskForAction(taskId);
  if (!task) return { ok: false, code: 404, message: TASK_NOT_FOUND };
  if (!canArchiveTask(user, task.ownerId)) return { ok: false, code: 403, message: TASK_FORBIDDEN };

  const isArchived = task.archivedAt !== null;
  if (archived && isArchived) return { ok: false, code: 409, message: ALREADY_ARCHIVED };
  if (!archived && !isArchived) return { ok: false, code: 409, message: NOT_ARCHIVED };

  await repo.setArchived(taskId, archived);
  return { ok: true, id: taskId };
}

export async function deleteTask(user: Authorizable, taskId: string): Promise<TaskResult> {
  const task = await repo.findTaskForAction(taskId);
  if (!task) return { ok: false, code: 404, message: TASK_NOT_FOUND };
  if (!canDeleteTask(user, task.ownerId)) return { ok: false, code: 403, message: TASK_FORBIDDEN };
  // A task with a recorded follow-up is archive-only, never deletable (C-11).
  if (task.followUpCount > 0) return { ok: false, code: 409, message: TASK_HAS_FOLLOWUP };

  await repo.deleteTask(taskId);
  return { ok: true, id: taskId };
}

// --- Tx-aware seams for the followups module (record-result transaction) -----
// The record-result flow (close the task, write the follow-up, maybe a next task)
// is one transaction owned by cases.runCaseMutation and orchestrated by the
// followups service. These re-exports let it drive the task writes without the
// followups module importing this module's repository (rule 9).
export { closeTaskTx, createTaskTx, cancelOpenTasksForCaseTx } from "./tasks.repository";
export { countOpenTasksForCase } from "./tasks.repository";
export type { TaskWriteData } from "./tasks.repository";

/** The task a record-result action targets (ownership + case + follow-up count). */
export function getTaskForAction(taskId: string) {
  return repo.findTaskForAction(taskId);
}
