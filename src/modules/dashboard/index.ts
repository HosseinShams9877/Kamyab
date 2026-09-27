// Public API of the dashboard module (C-2 management dashboard, C-15 employee
// panel landing). The dashboard is a pure aggregator: it owns no data and has no
// repository (rule 9) — its service composes the other modules' public seams.
// Server code imports from "@/modules/dashboard" only (rule 8). All the module's
// components are server components (no client leaf), so this barrel is safe to
// import from the dashboard pages.

// --- Service (server-only aggregator) ---------------------------------------
export { getManagerDashboard, getEmployeeDashboard } from "./dashboard.service";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  DashboardIndicator,
  ManagerDashboard,
  EmployeeDashboard,
} from "./dashboard.types";

// --- Module UI (server components) ------------------------------------------
export { IndicatorCard } from "./components/indicator-card";
export { NearRenewalsTable } from "./components/near-renewals-table";
export { TodayTasksTable } from "./components/today-tasks-table";
export { EmployeeWorkloadTable } from "./components/employee-workload-table";
