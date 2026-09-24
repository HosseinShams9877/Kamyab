import {
  applyExceptions,
  computeExceptions,
  mergeWithDefaults,
  type PermissionMap,
} from "./permissions.guard";
import {
  findExceptionsByEmployee,
  replaceExceptions,
} from "./permissions.repository";
import type { Role } from "@/types/enums";

// Permission business logic (services layer): role defaults overlaid with the
// per-employee exceptions stored in the database. The pure computation lives in
// ./permissions.guard (applyExceptions); the DB read lives in the repository.

/**
 * Load an employee's stored permission exceptions and fold them onto their role
 * default to produce the complete effective permission map.
 */
export async function getEffectivePermissions(
  employeeId: string,
  role: Role,
): Promise<PermissionMap> {
  const exceptions = await findExceptionsByEmployee(employeeId);
  return applyExceptions(role, exceptions);
}

/**
 * Persist an employee's desired permission map. The desired map (possibly
 * partial) is merged onto the role default, reduced to only the DIFFERENCES, and
 * those replace the employee's stored exceptions in one transaction. Returns the
 * complete effective map that now applies.
 */
export async function setEmployeePermissions(
  employeeId: string,
  role: Role,
  desired: Record<string, boolean>,
): Promise<PermissionMap> {
  const full = mergeWithDefaults(role, desired);
  const rows = computeExceptions(role, full);
  await replaceExceptions(employeeId, rows);
  return full;
}
