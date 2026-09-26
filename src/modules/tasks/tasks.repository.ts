import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for the tasks domain lives here (rule 9): the Task table and
// its own followUps aggregate (reading a task's OWN follow-up count is not a
// cross-module read — it is the Task relation). The record-result transaction is
// owned by the cases module (Case.lastActivityAt + ActivityHistory); this module
// contributes the task writes as tx-aware closures.

// Joined shape for a task row: owner name, optional case number, follow-up count.
const TASK_SELECT = {
  id: true,
  title: true,
  caseId: true,
  ownerId: true,
  dueDate: true,
  priority: true,
  status: true,
  note: true,
  archivedAt: true,
  createdById: true,
  case: { select: { number: true } },
  owner: { select: { fullName: true } },
  createdBy: { select: { fullName: true } },
  _count: { select: { followUps: true } },
} satisfies Prisma.TaskSelect;

export type TaskRecord = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

/** List tasks matching a where clause, newest due-date first then priority. */
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

// APPEND_MARKER

/** The data a task write needs (dates already converted to `Date`). */
export type TaskWriteData = {
  title: string;
  caseId: string | null;
  ownerId: string;
  dueDate: Date;
  priority: string;
  note: string | null;
  createdById: string;
};

/** Create a task. Used directly (plain create) and inside the record-result
 *  transaction (the optional "next task"), hence a tx-aware variant. */
export function createTaskTx(
  tx: Prisma.TransactionClient,
  data: TaskWriteData,
): Promise<{ id: string }> {
  return tx.task.create({
    data: {
      title: data.title,
      caseId: data.caseId,
      ownerId: data.ownerId,
      dueDate: data.dueDate,
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
      ownerId: data.ownerId,
      dueDate: data.dueDate,
      priority: data.priority,
      note: data.note,
    },
  });
}

/** Close a task as COMPLETED and stamp its close time (the archive threshold
 *  counts from here). Tx-aware — part of the record-result transaction. */
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

