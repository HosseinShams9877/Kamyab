import { applyExceptions, type PermissionMap } from "./permissions.guard";
import { findExceptionsByEmployee } from "./permissions.repository";
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
