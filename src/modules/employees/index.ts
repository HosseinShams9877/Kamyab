// Public API of the employees module (C-12). Other code imports employees
// functionality from "@/modules/employees" only — never reach into the
// service/repository/guard files directly. Client components import the
// isomorphic schema leaf ("@/modules/employees/employees.schema") instead, since
// this barrel pulls in server-only code (bcrypt, Prisma).

export {
  listEmployees,
  getEmployee,
  listDepartmentOptions,
  listSuccessorCandidates,
  listCaseOwnerOptions,
  listActiveManagerIds,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  reactivateEmployee,
  setPassword,
  getPermissionsView,
  updatePermissions,
  getWorkload,
  listWorkloads,
  deactivateEmployee,
} from "./employees.service";

export {
  createEmployeeSchema,
  updateEmployeeSchema,
  setPasswordSchema,
  permissionsSchema,
  deactivateSchema,
} from "./employees.schema";

export type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  SetPasswordInput,
  PermissionsInput,
  DeactivateInput,
} from "./employees.schema";

export type {
  EmployeeListItem,
  EmployeeDetail,
  DepartmentOption,
  EmployeeOption,
  Workload,
  WorkloadRow,
  PermissionsView,
  DeactivationResult,
  EmployeeStats,
} from "./employees.types";

// Module UI + presentation. Server code (app/ pages) imports these through the
// barrel. The components are client leaves that import the isomorphic schema
// leaf directly (never this barrel, which pulls in bcrypt/Prisma).
export { EmployeeForm } from "./components/employee-form";
export { SetPasswordForm } from "./components/set-password-form";
export { PermissionMatrix } from "./components/permission-matrix";
export { DeactivatePanel } from "./components/deactivate-panel";
export { ReactivateButton } from "./components/reactivate-button";
export { EmployeeRowActions } from "./components/employee-row-actions";

export { ROLE_LABELS } from "./lib/permission-labels";