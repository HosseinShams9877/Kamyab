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

// The tasks page (C-11): seven ownership-scoped views, create/edit, record-result,
// archive and delete. Server component — it authorizes (rule 3), reads through the
// services, and hands the client panel already-scoped rows + the capability flags.
// Dynamic: the active tab comes from the query string and "today"/"overdue" depend
// on the current date, so the view is computed per request (rule 2).
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "tasks.view_all") && !can(user, "tasks.view_own")) {
    redirect("/dashboard");
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">کارها</h1>
      <TasksPanel
        tasks={tasks}
        tab={tab}
        tabs={tabs}
        formData={formData}
        results={results.map((r) => ({ id: r.id, title: r.title }))}
        caps={caps}
        viewAll={viewAll}
      />
    </main>
  );
}
