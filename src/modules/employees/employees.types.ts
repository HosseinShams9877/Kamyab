import type { Role } from "@/types/enums";
import type { PermissionMap } from "@/modules/permissions";

// TypeScript types for the employees domain. Persian labels are presentation
// concerns and live in the components, not here.

export type EmployeeListItem = {
  id: string;
  fullName: string;
  mobile: string;
  email: string | null;
  role: Role;
  status: boolean;
  departmentTitle: string | null;
  activeCases: number;
  createdAt: string; // Jalali YYYY/MM/DD
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

export type EmployeeOption = { id: string; fullName: string };

export type Workload = { activeCases: number; openTasks: number };

export type WorkloadRow = {
  id: string;
  fullName: string;
  department: string | null;
  activeCases: number;
  todaysTasks: number;
  overdueTasks: number;
};

export type PermissionsView = {
  role: Role;
  defaults: PermissionMap;
  effective: PermissionMap;
};

export type DeactivationResult =
  | { ok: true; transferred: Workload }
  | { ok: false; reason: "self" | "last_manager" | "already_inactive" | "successor_invalid"; message: string }
  | { ok: false; reason: "successor_required"; message: string; workload: Workload };

/** The four headline stats above the employees list (C-12). */
export type EmployeeStats = {
  active: number;
  inactive: number;
  roles: number; // count of distinct roles in use
  permissionOverrides: number; // count of stored permission exceptions
};