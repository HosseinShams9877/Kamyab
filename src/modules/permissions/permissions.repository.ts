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
