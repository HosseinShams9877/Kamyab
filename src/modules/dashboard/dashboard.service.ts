import type { CurrentUser } from "@/modules/auth";
import {
  countActiveCases,
  countStaleCases,
  getActiveReceivables,
} from "@/modules/cases";
import { getTasksView } from "@/modules/tasks";
import { getRenewalDashboard } from "@/modules/periods";
import { listWorkloads } from "@/modules/employees";
import { formatToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/digits";
import type {
  DashboardIndicator,
  EmployeeDashboard,
  ManagerDashboard,
} from "./dashboard.types";

// Business logic for the dashboard (C-2). This module owns no data of its own:
// it is the one place allowed to fan out across several other modules' public
// service seams and compose their results into the landing views. Every number
// here is computed at read time (rule 2) and scoped to the acting user (rule 3)
// inside the seams it calls — the dashboard never touches Prisma or another
// module's repository (rule 9), which is why it has no repository file.

function count(value: number): string {
  return toPersianDigits(String(value));
}

/**
 * The management dashboard (C-2): seven live indicators over the whole practice
 * plus the near-renewals, today's-tasks and employee-workload tables. The user
 * is a manager/supervisor, so the cases/tasks seams resolve to the unscoped
 * (view_all) view; `getRenewalDashboard(null)` and `listWorkloads()` cover every
 * owner. All seams run concurrently.
 */
export async function getManagerDashboard(
  user: CurrentUser,
): Promise<ManagerDashboard> {
  const [
    activeCases,
    receivables,
    staleCases,
    todaysTasks,
    overdueTasks,
    renewals,
    workloads,
  ] = await Promise.all([
    countActiveCases(user),
    getActiveReceivables(user),
    countStaleCases(user),
    getTasksView(user, "today"),
    getTasksView(user, "overdue"),
    getRenewalDashboard(null),
    listWorkloads(),
  ]);

  const indicators: DashboardIndicator[] = [
    { key: "activeCases", label: "پرونده‌های فعال", value: count(activeCases), href: "/cases?status=active", tone: "default" },
    { key: "todaysTasks", label: "کارهای امروز", value: count(todaysTasks.length), href: "/tasks?tab=today", tone: "default" },
    { key: "overdueTasks", label: "کارهای عقب‌افتاده", value: count(overdueTasks.length), href: "/tasks?tab=overdue", tone: "danger" },
    { key: "nearRenewals", label: "تمدیدهای نزدیک", value: count(renewals.nearCount), href: "/renewals?tab=near", tone: "warning" },
    { key: "receivables", label: "مطالبات معوق", value: formatToman(receivables), href: "/cases?hasBalance=1", tone: "warning" },
    { key: "staleCases", label: "پرونده‌های راکد", value: count(staleCases), href: "/cases?stale=1", tone: "warning" },
    { key: "abandonedRenewals", label: "تمدیدهای رهاشده", value: count(renewals.abandonedCount), href: "/renewals?tab=abandoned", tone: "danger" },
  ];

  return { indicators, nearRenewals: renewals.near, todaysTasks, workloads };
}

/**
 * The employee dashboard (C-15): the same computed metrics, but every seam is
 * owner-scoped to the acting user (view_own resolves to `{ ownerId: user.id }`),
 * the near-renewals feed is narrowed to the user's own cases, and there is no
 * employee-workload table. Indicators link into the owner-scoped /employee pages.
 */
export async function getEmployeeDashboard(
  user: CurrentUser,
): Promise<EmployeeDashboard> {
  const [activeCases, staleCases, todaysTasks, overdueTasks, renewals] =
    await Promise.all([
      countActiveCases(user),
      countStaleCases(user),
      getTasksView(user, "today"),
      getTasksView(user, "overdue"),
      getRenewalDashboard(user.id),
    ]);

  const indicators: DashboardIndicator[] = [
    { key: "activeCases", label: "پرونده‌های فعال", value: count(activeCases), href: "/employee/cases?status=active", tone: "default" },
    { key: "todaysTasks", label: "کارهای امروز", value: count(todaysTasks.length), href: "/employee/tasks?tab=today", tone: "default" },
    { key: "overdueTasks", label: "کارهای عقب‌افتاده", value: count(overdueTasks.length), href: "/employee/tasks?tab=overdue", tone: "danger" },
    { key: "nearRenewals", label: "تمدیدهای نزدیک", value: count(renewals.nearCount), href: "/employee/renewals?tab=near", tone: "warning" },
    { key: "staleCases", label: "پرونده‌های راکد", value: count(staleCases), href: "/employee/cases?stale=1", tone: "warning" },
  ];

  return { indicators, nearRenewals: renewals.near, todaysTasks };
}
