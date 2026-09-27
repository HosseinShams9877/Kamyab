import type { TaskRow } from "@/modules/tasks";
import type { RenewalRow } from "@/modules/periods";
import type { WorkloadRow } from "@/modules/employees";

// Isomorphic types for the dashboard domain (C-2). The dashboard module is a
// pure aggregator: it owns no table and no repository (rule 9), composing the
// other modules' read seams into the manager and employee landing views.

/** One headline indicator. `value` is already presentation-formatted (Persian
 *  digits, or a Toman amount); `href` points at the filtered list that explains
 *  it. `tone` colours the attention-grabbing metrics (overdue work, stalled
 *  cases, abandoned renewals) apart from the neutral ones. */
export type DashboardIndicator = {
  key: string;
  label: string;
  value: string;
  href: string;
  tone: "default" | "warning" | "danger";
};

/** The management landing (C-2): seven indicators + three tables. */
export type ManagerDashboard = {
  indicators: DashboardIndicator[];
  nearRenewals: RenewalRow[];
  todaysTasks: TaskRow[];
  workloads: WorkloadRow[];
};

/** The employee landing (C-15): the same shape minus the employee-status table
 *  (a workload report is a management-oversight view, never shown to the staff
 *  member themselves), and every metric owner-scoped to the acting user. */
export type EmployeeDashboard = {
  indicators: DashboardIndicator[];
  nearRenewals: RenewalRow[];
  todaysTasks: TaskRow[];
};
