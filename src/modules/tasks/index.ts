// Public API of the tasks module (C-11 tasks, follow-ups, archive). Other server
// code imports tasks functionality from "@/modules/tasks" only (rule 8). Client
// components are the exception: they import the isomorphic leaves (./tasks.schema,
// ./tasks.types, ./tasks.guards, ./lib) directly, never this barrel (it pulls in
// server-only Prisma code via the service/repository).

// --- Service (server-only: Prisma, cross-module seams, authorization) --------
export {
  canCreateTask,
  canAssignTasks,
  canEditTask,
  canRecordResult,
  canArchiveTask,
  canDeleteTask,
  getTaskFormData,
  getTasksView,
  createTask,
  updateTask,
  setTaskArchived,
  deleteTask,
  getTaskForAction,
  closeTaskTx,
  createTaskTx,
  cancelOpenTasksForCaseTx,
  countOpenTasksForCase,
  archiveClosedTasksBefore,
  listOverdueOwners,
} from "./tasks.service";
export type { TaskResult, TaskWriteData } from "./tasks.service";

// --- Schema (isomorphic) ----------------------------------------------------
export { taskCreateSchema, taskUpdateSchema } from "./tasks.schema";
export type { TaskCreateInput, TaskUpdateInput } from "./tasks.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  TaskPriorityKey,
  TaskStatusKey,
  TaskTab,
  TaskRow,
  TaskOwnerOption,
  TaskCaseOption,
  TaskFormData,
} from "./tasks.types";
export { TASK_TABS } from "./tasks.types";

// --- Guards (isomorphic: error + Persian messages + overdue helper) ---------
export { TaskRuleError, isOverdue } from "./tasks.guards";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
  TASK_TAB_LABELS,
} from "./lib/labels";

// --- Module UI (re-exported for server consumers: the tasks page) -----------
export { TasksPanel } from "./components/tasks-panel";
export type { TaskCaps } from "./components/tasks-panel";
