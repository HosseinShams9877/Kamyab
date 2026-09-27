import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getTasksView,
  getTaskFormData,
  TasksPanel,
  TASK_TABS,
  TASK_TAB_LABELS,
  type TaskTab,
} from "@/modules/tasks";
import { listActiveResults } from "@/modules/followups";

// Employee "my tasks" panel (C-15). Identical to the manager /tasks page — the
// tasks service owner-scopes an employee (tasks.view_own) to their own tasks —
// except the tab links resolve against /employee/tasks (via TasksPanel's
// basePath) so navigation stays inside the employee panel.
export const dynamic = "force-dynamic";

export default async function EmployeeTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "tasks.view_all") && !can(user, "tasks.view_own")) {
    redirect("/employee");
  }

  const { tab: tabParam } = await searchParams;
  const tab: TaskTab = (TASK_TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as TaskTab)
    : "all";

  const [tasks, formData, results] = await Promise.all([
    getTasksView(user, tab),
    getTaskFormData(user),
    listActiveResults(),
  ]);

  const caps = {
    create: can(user, "tasks.create"),
    assign: can(user, "tasks.assign"),
    record: can(user, "tasks.record_result"),
    archive: can(user, "tasks.archive"),
    delete: can(user, "tasks.delete"),
  };
  const viewAll = can(user, "tasks.view_all");

  const tabs = TASK_TABS.map((k) => ({ key: k, label: TASK_TAB_LABELS[k] }));

  return (
    <main className="mx-auto w-full px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">کارهای من</h1>
      <TasksPanel
        tasks={tasks}
        tab={tab}
        tabs={tabs}
        formData={formData}
        results={results.map((r) => ({ id: r.id, title: r.title }))}
        caps={caps}
        viewAll={viewAll}
        basePath="/employee/tasks"
      />
    </main>
  );
}
