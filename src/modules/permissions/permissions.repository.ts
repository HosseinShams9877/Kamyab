import { prisma } from "@/lib/db";
import type { PermissionExceptionRow } from "./permissions.guard";

// Data access for the permissions domain. The only place that touches the
// PermissionException table; the service layer calls this, other modules call
// the service (never this repository directly).

/**
 * Load an employee's stored permission exceptions — the DIFFERENCES from their
 * role default, never the whole set (database-schema.md).
 */
export function findExceptionsByEmployee(
  employeeId: string,
): Promise<PermissionExceptionRow[]> {
  return prisma.permissionException.findMany({
    where: { employeeId },
    select: { permissionKey: true, allowed: true },
  });
}

/**
 * Replace an employee's stored exceptions with exactly `rows`, in a single
 * transaction (delete-all then recreate). Called only by the permissions
 * service — other modules go through setEmployeePermissions.
 */
export async function replaceExceptions(
  employeeId: string,
  rows: readonly PermissionExceptionRow[],
): Promise<void> {
  await prisma.$transaction([
    prisma.permissionException.deleteMany({ where: { employeeId } }),
    prisma.permissionException.createMany({
      data: rows.map((r) => ({
        employeeId,
        permissionKey: r.permissionKey,
        allowed: r.allowed,
      })),
    }),
  ]);
}
