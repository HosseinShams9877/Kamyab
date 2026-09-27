import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getTasksView,
  getTaskStats,
  listTaskServiceOptions,
  TasksPanel,
  TASK_TABS,
  TASK_TAB_LABELS,
  type TaskTab,
  type TaskListParams,
  type TaskOwnerOption,
  type TaskServiceOption,
} from "@/modules/tasks";
import { listCaseOwnerOptions } from "@/modules/employees";
import { toPersianDigits } from "@/lib/digits";

// The tasks page (C-11): stat cards + tabs + filter bar + table.

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    ownerId?: string;
    serviceId?: string;
    priority?: string;
  }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "tasks.view_all") && !can(user, "tasks.view_own")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const tab: TaskTab = (TASK_TABS as string[]).includes(sp.tab ?? "")
    ? (sp.tab as TaskTab)
    : "all";

  const params: TaskListParams = {
    q: sp.q ?? "",
    ownerId: sp.ownerId ?? "",
    serviceId: sp.serviceId ?? "",
    priority:
      sp.priority === "NORMAL" ||
      sp.priority === "HIGH" ||
      sp.priority === "URGENT"
        ? sp.priority
        : "",
  };

  const [tasks, stats, services, ownerRows] = await Promise.all([
    getTasksView(user, tab, params),
    getTaskStats(user),
    listTaskServiceOptions(),
    listCaseOwnerOptions(),
  ]);

  const owners: TaskOwnerOption[] = ownerRows.map((o) => ({
    id: o.id,
    fullName: o.fullName,
  }));
  const serviceOptions: TaskServiceOption[] = services.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const mayCreate = can(user, "tasks.create");
  const tabs = TASK_TABS.map((k) => ({ key: k, label: TASK_TAB_LABELS[k] }));

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "thisWeek", label: "کارهای این هفته", value: stats.thisWeek, tone: "text-text" },
    { key: "today", label: "امروز", value: stats.today, tone: "text-success" },
    { key: "overdue", label: "عقب‌افتاده", value: stats.overdue, tone: "text-error" },
    {
      key: "completedThisWeek",
      label: "تکمیل‌شده این هفته",
      value: stats.completedThisWeek,
      tone: "text-text-secondary",
    },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">پیگیری‌ها و کارها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            کنترل فعالیت عملیاتی کل تیم
          </p>
        </div>
        {mayCreate && (
          <Link
            href="/tasks/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            + ثبت کار جدید
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="rounded-card border border-border bg-card p-5 shadow-card"
          >
            <div className="text-sm text-text-secondary">{s.label}</div>
            <div className={`mt-2 text-2xl font-bold ${s.tone}`}>
              {toPersianDigits(String(s.value))}
            </div>
          </div>
        ))}
      </div>

      <TasksPanel
        tasks={tasks}
        tab={tab}
        tabs={tabs}
        owners={owners}
        services={serviceOptions}
        params={params}
      />
    </main>
  );
}