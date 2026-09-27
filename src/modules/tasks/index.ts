// Public API of the tasks module (C-11 tasks, follow-ups, archive).

export {
  canCreateTask,
  canAssignTasks,
  canEditTask,
  canRecordResult,
  canArchiveTask,
  canDeleteTask,
  getTaskFormData,
  getTasksView,
  getTaskStats,
  listTaskServiceOptions,
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

export { taskCreateSchema, taskUpdateSchema } from "./tasks.schema";
export type { TaskCreateInput, TaskUpdateInput } from "./tasks.schema";

export type {
  TaskPriorityKey,
  TaskStatusKey,
  TaskTab,
  TaskRow,
  TaskOwnerOption,
  TaskCaseOption,
  TaskCustomerOption,
  TaskFormData,
  TaskStats,
  TaskListParams,
  TaskServiceOption,
} from "./tasks.types";
export { TASK_TABS } from "./tasks.types";

export { TaskRuleError, isOverdue } from "./tasks.guards";

export {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
  TASK_TAB_LABELS,
} from "./lib/labels";

export { TasksPanel } from "./components/tasks-panel";
export { TaskForm } from "./components/task-form";
export { TasksTable } from "./components/tasks-table";