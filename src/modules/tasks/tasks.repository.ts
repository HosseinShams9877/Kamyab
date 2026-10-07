import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for the tasks domain lives here (rule 9): the Task table and
// its own followUps aggregate. The record-result transaction is owned by the
// cases module; this module contributes the task writes as tx-aware closures.

// Joined shape for a task row: owner name, optional case + its service, an
// optional direct customer, follow-up count.
const TASK_SELECT = {
  id: true,
  title: true,
  caseId: true,
  customerId: true,
  ownerId: true,
  dueDate: true,
  dueTime: true,
  priority: true,
  status: true,
  note: true,
  archivedAt: true,
  createdById: true,
  case: {
    select: {
      number: true,
      service: { select: { name: true } },
      customer: { select: { fullName: true, companyName: true } },
    },
  },
  customer: { select: { fullName: true, companyName: true } },
  owner: { select: { fullName: true } },
  createdBy: { select: { fullName: true } },
  _count: { select: { followUps: true } },
} satisfies Prisma.TaskSelect;

export type TaskRecord = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

/** List tasks matching a where clause, soonest due-date first. */
export function findTasks(where: Prisma.TaskWhereInput): Promise<TaskRecord[]> {
  return prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    select: TASK_SELECT,
  });
}

/** A single task with the fields the actions need (ownership + follow-up count). */
export async function findTaskForAction(taskId: string): Promise<
  | {
      id: string;
      title: string;
      ownerId: string;
      caseId: string | null;
      status: string;
      archivedAt: Date | null;
      followUpCount: number;
    }
  | null
> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      caseId: true,
      status: true,
      archivedAt: true,
      _count: { select: { followUps: true } },
    },
  });
  if (!t) return null;
  return {
    id: t.id,
    title: t.title,
    ownerId: t.ownerId,
    caseId: t.caseId,
    status: t.status,
    archivedAt: t.archivedAt,
    followUpCount: t._count.followUps,
  };
}

// --- Task list stats (C-11 style) -------------------------------------------

/** Open tasks due in [from, to). */
export function countOpenDueBetween(
  from: Date,
  to: Date,
  ownerId?: string,
): Promise<number> {
  return prisma.task.count({
    where: {
      status: "OPEN",
      archivedAt: null,
      dueDate: { gte: from, lt: to },
      ...(ownerId ? { ownerId } : {}),
    },
  });
}

/** Open tasks due before `before` (overdue). */
export function countOpenDueBefore(
  before: Date,
  ownerId?: string,
): Promise<number> {
  return prisma.task.count({
    where: {
      status: "OPEN",
      archivedAt: null,
      dueDate: { lt: before },
      ...(ownerId ? { ownerId } : {}),
    },
  });
}

/** Tasks with status COMPLETED whose closedAt falls in [from, to). */
export function countCompletedBetween(
  from: Date,
  to: Date,
  ownerId?: string,
): Promise<number> {
  return prisma.task.count({
    where: {
      status: "COMPLETED",
      closedAt: { gte: from, lt: to },
      ...(ownerId ? { ownerId } : {}),
    },
  });
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------

/** Auto-archive: mark every COMPLETED/CANCELLED task closed before `cutoff` as
 *  archived. Idempotent (already-archived rows are excluded). Returns the number
 *  newly archived. */
export async function archiveClosedTasksBefore(cutoff: Date): Promise<number> {
  const res = await prisma.task.updateMany({
    where: {
      status: { in: ["COMPLETED", "CANCELLED"] },
      closedAt: { lt: cutoff },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });
  return res.count;
}

/** OPEN, non-archived tasks due before `before`, with the owner's id + name. */
export async function findOverdueOpenTasks(
  before: Date,
): Promise<{ ownerId: string; ownerName: string }[]> {
  const rows = await prisma.task.findMany({
    where: { status: "OPEN", archivedAt: null, dueDate: { lt: before } },
    select: { ownerId: true, owner: { select: { fullName: true } } },
  });
  return rows.map((r) => ({ ownerId: r.ownerId, ownerName: r.owner.fullName }));
}

/** Cancel every OPEN task of a case and notify each distinct owner (C-8). */
export async function cancelOpenTasksForCaseTx(
  tx: Prisma.TransactionClient,
  args: { caseId: string; message: string },
): Promise<void> {
  const open = await tx.task.findMany({
    where: { caseId: args.caseId, status: "OPEN" },
    select: { ownerId: true },
  });
  if (open.length === 0) return;
  await tx.task.updateMany({
    where: { caseId: args.caseId, status: "OPEN" },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
  const ownerIds = [...new Set(open.map((t) => t.ownerId))];
  await tx.notification.createMany({
    data: ownerIds.map((userId) => ({ userId, message: args.message })),
  });
}

/** How many OPEN tasks a case has, for the cancel dialog's warning summary (C-8). */
export function countOpenTasksForCase(caseId: string): Promise<number> {
  return prisma.task.count({ where: { caseId, status: "OPEN" } });
}

/** The data a task write needs (dates already converted to `Date`). */
export type TaskWriteData = {
  title: string;
  caseId: string | null;
  customerId: string | null;
  ownerId: string;
  dueDate: Date;
  dueTime: string | null;
  priority: string;
  note: string | null;
  createdById: string;
};

/** Create a task. Used directly and inside the record-result transaction. */
export function createTaskTx(
  tx: Prisma.TransactionClient,
  data: TaskWriteData,
): Promise<{ id: string }> {
  return tx.task.create({
    data: {
      title: data.title,
      caseId: data.caseId,
      customerId: data.customerId,
      ownerId: data.ownerId,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      priority: data.priority,
      status: "OPEN",
      note: data.note,
      createdById: data.createdById,
    },
    select: { id: true },
  });
}

export function createTask(data: TaskWriteData): Promise<{ id: string }> {
  return prisma.$transaction((tx) => createTaskTx(tx, data));
}

/** Update the editable fields of a task (never its status/archive/created-by). */
export function updateTask(
  taskId: string,
  data: Omit<TaskWriteData, "createdById">,
): Promise<unknown> {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      title: data.title,
      caseId: data.caseId,
      customerId: data.customerId,
      ownerId: data.ownerId,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      priority: data.priority,
      note: data.note,
    },
  });
}

/** Close a task as COMPLETED and stamp its close time. Tx-aware. */
export function closeTaskTx(
  tx: Prisma.TransactionClient,
  taskId: string,
): Promise<unknown> {
  return tx.task.update({
    where: { id: taskId },
    data: { status: "COMPLETED", closedAt: new Date() },
  });
}

/** Manual archive / unarchive (C-11). Auto-archive is Phase 15. */
export function setArchived(taskId: string, archived: boolean): Promise<unknown> {
  return prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

/** Hard-delete a task. The service permits this only when the task has no
 *  follow-up (a task with a recorded result is archive-only, C-11). */
export function deleteTask(taskId: string): Promise<unknown> {
  return prisma.task.delete({ where: { id: taskId } });
}

// --- Stage-due reminders tab (تب یادآوری‌ها) --------------------------------

export type StageDueRow = {
  id: string;
  title: string;
  dueDate: Date | null;
  period: {
    case: {
      id: string;
      number: string;
      ownerId: string;
      owner: { fullName: string };
      service: { name: string };
      customer: {
        type: string;
        fullName: string | null;
        companyName: string | null;
      };
    };
  };
};

/** Open stages with a due date on an active period of a non-cancelled case,
 *  optionally scoped to one owner. Soonest due-date first. */
export async function findStageDueTasks(ownerId?: string): Promise<StageDueRow[]> {
  return prisma.caseStage.findMany({
    where: {
      dueDate: { not: null },
      status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] },
      period: {
        status: "ACTIVE",
        case: {
          status: { not: "CANCELLED" },
          ...(ownerId ? { ownerId } : {}),
        },
      },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      period: {
        select: {
          case: {
            select: {
              id: true,
              number: true,
              ownerId: true,
              owner: { select: { fullName: true } },
              service: { select: { name: true } },
              customer: {
                select: { type: true, fullName: true, companyName: true },
              },
            },
          },
        },
      },
    },
  });
}