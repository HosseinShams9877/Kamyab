import type { Role } from "@/types/enums";
import type { PermissionMap } from "@/modules/permissions";

// TypeScript types for the employees domain. Persian labels are presentation
// concerns and live in the components, not here.

export type EmployeeListItem = {
  id: string;
  fullName: string;
  mobile: string;
  role: Role;
  status: boolean;
  departmentTitle: string | null;
};

export type EmployeeDetail = {
  id: string;
  fullName: string;
  mobile: string;
  email: string | null;
  departmentId: string | null;
  role: Role;
  status: boolean;
};

export type DepartmentOption = { id: string; title: string };

// A lightweight active-employee row used to populate the successor / owner
// selects on the deactivation flow.
export type EmployeeOption = { id: string; fullName: string };

export type Workload = { activeCases: number; openTasks: number };

/** A row of the dashboard's employee-workload table (C-2 / the workload report).
 *  Purely a workload-control view — never a performance metric. */
export type WorkloadRow = {
  id: string;
  fullName: string;
  department: string | null;
  activeCases: number;
  todaysTasks: number;
  overdueTasks: number;
};

// The permission matrix needs the role default AND the current effective value
// for every key, so the UI can show "default: allowed" next to each toggle.
export type PermissionsView = {
  role: Role;
  defaults: PermissionMap;
  effective: PermissionMap;
};

// Result of attempting a deactivation. `blocked` carries a Persian reason the
// route surfaces to the manager; `successorRequired` additionally carries the
// workload counts and the candidate list so the UI can ask for a successor.
export type DeactivationResult =
  | { ok: true; transferred: Workload }
  | { ok: false; reason: "self" | "last_manager" | "already_inactive" | "successor_invalid"; message: string }
  | { ok: false; reason: "successor_required"; message: string; workload: Workload };
