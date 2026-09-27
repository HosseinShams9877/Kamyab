import type { Prisma } from "@prisma/client";
import {
  parseJalali,
  toGregorianDate,
  toJalali,
  formatJalali,
  todayJalali,
} from "@/lib/jalali";
import { can, scopeByOwnership, type Authorizable } from "@/modules/permissions";
import { listActiveCaseOptions } from "@/modules/cases";
import { listCaseOwnerOptions } from "@/modules/employees";
import { listActiveCustomerOptions } from "@/modules/customers";
import { listActiveServiceOptions } from "@/modules/services";
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
  TaskStats,
  TaskListParams,
  TaskServiceOption,
  TaskCaseOption,
} from "./tasks.types";

// Business logic for the tasks domain (C-11).

/** A task write/action result the API routes map to an HTTP status. */
export type TaskResult =
  | { ok: true; id?: string }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

// --- Authorization (record-scoped, rule 3) ---------------------------------

export function canCreateTask(user: Authorizable): boolean {
  return can(user, "tasks.create");
}

export function canAssignTasks(user: Authorizable): boolean {
  return can(user, "tasks.assign");
}

export function canEditTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.create", { ownerId });
}

export function canRecordResult(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.record_result", { ownerId });
}

export function canArchiveTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.archive", { ownerId });
}

export function canDeleteTask(user: Authorizable, ownerId: string): boolean {
  return can(user, "tasks.delete", { ownerId });
}

// --- Reads ------------------------------------------------------------------

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date): string {
  return formatJalali(toJalali(date), { persianDigits: false });
}

/**
 * Everything the task form needs: active owners, active cases (both a flat
 * list and grouped by customer), active customers, and the current user.
 */
export async function getTaskFormData(user: Authorizable): Promise<TaskFormData> {
  const [owners, cases, customers] = await Promise.all([
    listCaseOwnerOptions(),
    listActiveCaseOptions(),
    listActiveCustomerOptions(),
  ]);

  // Group active cases by their customerId, so the picker can narrow.
  const { prisma } = await import("@/lib/db");
  const caseRows = await prisma.case.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      number: true,
      customerId: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
    },
  });

  const casesByCustomer: Record<string, TaskCaseOption[]> = {};
  for (const c of caseRows) {
    const name =
      c.customer.type === "LEGAL" ? c.customer.companyName : c.customer.fullName;
    (casesByCustomer[c.customerId] ??= []).push({
      id: c.id,
      number: c.number,
      label: name ? `${c.number} — ${name}` : c.number,
    });
  }

  return {
    owners,
    cases,
    customers: customers.map((c) => ({ id: c.id, displayName: c.displayName })),
    casesByCustomer,
    currentUserId: user.id,
  };
}

/** Map a stored task row to the client view, computing `overdue` + `hasFollowUp`
 *  live (rule 2) and rendering dates as ASCII Jalali. */
function toRow(r: repo.TaskRecord, today: ReturnType<typeof todayJalali>): TaskRow {
  const status = r.status as TaskStatusKey;
  const archived = r.archivedAt !== null;
  // Prefer the direct customer; fall back to the case's customer.
  const custName =
    r.customer?.fullName ??
    r.customer?.companyName ??
    r.case?.customer?.fullName ??
    r.case?.customer?.companyName ??
    null;
  return {
    id: r.id,
    title: r.title,
    caseId: r.caseId,
    caseNumber: r.case?.number ?? null,
    customerId: r.customerId,
    customerName: custName,
    serviceName: r.case?.service?.name ?? null,
    ownerId: r.ownerId,
    ownerName: r.owner.fullName,
    dueDate: dateToJalali(r.dueDate),
    dueTime: r.dueTime ?? null,
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

/** Normalize a user-typed query: trim it. */
function normalizeQuery(q: string): string {
  return q.trim();
}

/**
 * The task rows for one of the seven tabs (C-11), ownership-scoped (rule 3),
 * with optional filters (search, owner, service, priority).
 */
export async function getTasksView(
  user: Authorizable,
  tab: TaskTab,
  params: TaskListParams = {},
): Promise<TaskRow[]> {
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

  // Filters — applied on top of the tab scope.
  if (params.ownerId && params.ownerId.trim()) {
    where.ownerId = params.ownerId.trim();
  }
  if (params.serviceId && params.serviceId.trim()) {
    where.case = { is: { serviceId: params.serviceId.trim() } };
  }
  if (params.priority && params.priority.trim()) {
    where.priority = params.priority.trim();
  }
  const q = normalizeQuery(params.q ?? "");
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { case: { is: { number: { contains: q } } } },
      { case: { is: { customer: { is: { fullName: { contains: q } } } } } },
      { case: { is: { customer: { is: { companyName: { contains: q } } } } } },
      { case: { is: { service: { is: { name: { contains: q } } } } } },
      { customer: { is: { fullName: { contains: q } } } },
      { customer: { is: { companyName: { contains: q } } } },
      { owner: { is: { fullName: { contains: q } } } },
    ];
  }

  const rows = await repo.findTasks(where);
  return rows.map((r) => toRow(r, todayJ));
}

// --- Task stats (C-11 style, /tasks header) ---------------------------------

/** The four headline numbers above the tasks list, scoped like the list. */
export async function getTaskStats(user: Authorizable): Promise<TaskStats> {
  const scope = scopeByOwnership(user, "tasks");
  if (scope === null) {
    return { thisWeek: 0, today: 0, overdue: 0, completedThisWeek: 0 };
  }
  const ownerId = "ownerId" in scope ? scope.ownerId : undefined;

  const todayJ = todayJalali();
  const todayStart = toGregorianDate(todayJ);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  // Jalali week: Saturday (start) → Friday (end).
  const jsDay = todayStart.getDay(); // 0=Sun..6=Sat
  const daysSinceSaturday = (jsDay + 1) % 7;
  const weekStart = new Date(todayStart.getTime() - daysSinceSaturday * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [thisWeek, today, overdue, completedThisWeek] = await Promise.all([
    repo.countOpenDueBetween(weekStart, weekEnd, ownerId),
    repo.countOpenDueBetween(todayStart, tomorrowStart, ownerId),
    repo.countOpenDueBefore(todayStart, ownerId),
    repo.countCompletedBetween(weekStart, weekEnd, ownerId),
  ]);

  return { thisWeek, today, overdue, completedThisWeek };
}

/** Active services for the list's service filter dropdown. */
export async function listTaskServiceOptions(): Promise<TaskServiceOption[]> {
  const services = await listActiveServiceOptions();
  return services.map((s) => ({ id: s.id, name: s.name }));
}

// --- Writes (create / update / archive / delete) ----------------------------

async function resolveWrite(
  input: TaskCreateInput,
): Promise<
  | {
      ok: true;
      caseId: string | null;
      customerId: string | null;
      ownerId: string;
      dueDate: Date;
      dueTime: string | null;
      priority: string;
      note: string | null;
    }
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

  // Optional direct customer.
  let customerId: string | null = null;
  if (input.customerId && input.customerId.trim()) {
    const customers = await listActiveCustomerOptions();
    if (customers.some((c) => c.id === input.customerId)) {
      customerId = input.customerId;
    }
  }

  const j = parseJalali(input.dueDate);
  if (!j) return { ok: false, code: 422, message: DUE_DATE_INVALID };

  const dueTime =
    input.dueTime && /^\d{1,2}:\d{2}$/.test(input.dueTime.trim())
      ? input.dueTime.trim()
      : null;

  const note = input.note && input.note.trim() ? input.note.trim() : null;
  return {
    ok: true,
    caseId,
    customerId,
    ownerId: input.ownerId,
    dueDate: toGregorianDate(j),
    dueTime,
    priority: input.priority,
    note,
  };
}

export async function createTask(user: Authorizable, input: TaskCreateInput): Promise<TaskResult> {
  if (!canCreateTask(user)) return { ok: false, code: 403, message: TASK_FORBIDDEN };
  if (input.ownerId !== user.id && !canAssignTasks(user)) {
    return { ok: false, code: 403, message: TASK_FORBIDDEN };
  }

  const resolved = await resolveWrite(input);
  if (!resolved.ok) return resolved;

  const { id } = await repo.createTask({
    title: input.title,
    caseId: resolved.caseId,
    customerId: resolved.customerId,
    ownerId: resolved.ownerId,
    dueDate: resolved.dueDate,
    dueTime: resolved.dueTime,
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
  if (input.ownerId !== user.id && input.ownerId !== task.ownerId && !canAssignTasks(user)) {
    return { ok: false, code: 403, message: TASK_FORBIDDEN };
  }

  const resolved = await resolveWrite(input);
  if (!resolved.ok) return resolved;

  await repo.updateTask(taskId, {
    title: input.title,
    caseId: resolved.caseId,
    customerId: resolved.customerId,
    ownerId: resolved.ownerId,
    dueDate: resolved.dueDate,
    dueTime: resolved.dueTime,
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
  if (task.followUpCount > 0) return { ok: false, code: 409, message: TASK_HAS_FOLLOWUP };

  await repo.deleteTask(taskId);
  return { ok: true, id: taskId };
}

// --- Tx-aware seams for the followups module --------------------------------
export { closeTaskTx, createTaskTx, cancelOpenTasksForCaseTx } from "./tasks.repository";
export { countOpenTasksForCase } from "./tasks.repository";
export type { TaskWriteData } from "./tasks.repository";

export function getTaskForAction(taskId: string) {
  return repo.findTaskForAction(taskId);
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------

export function archiveClosedTasksBefore(cutoff: Date): Promise<number> {
  return repo.archiveClosedTasksBefore(cutoff);
}

export async function listOverdueOwners(
  now: Date = new Date(),
): Promise<{ ownerId: string; ownerName: string; count: number }[]> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = await repo.findOverdueOpenTasks(startOfToday);
  const byOwner = new Map<string, { ownerId: string; ownerName: string; count: number }>();
  for (const r of rows) {
    const existing = byOwner.get(r.ownerId);
    if (existing) existing.count += 1;
    else byOwner.set(r.ownerId, { ownerId: r.ownerId, ownerName: r.ownerName, count: 1 });
  }
  return [...byOwner.values()];
}