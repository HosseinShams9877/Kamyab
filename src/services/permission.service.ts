import { prisma } from "@/lib/db";
import {
  applyExceptions,
  type PermissionMap,
} from "@/lib/permissions";
import type { Role } from "@/types/enums";

// Permission business logic (services layer): role defaults overlaid with the
// per-employee exceptions stored in the database. The pure computation lives in
// src/lib/permissions.ts (applyExceptions); this module owns the DB read.

/**
 * Load an employee's stored permission exceptions and fold them onto their role
 * default to produce the complete effective permission map.
 *
 * Callers that already hold the employee's `permissionExceptions` relation
 * (e.g. getCurrentUser, which loads it in the same query) should call
 * `applyExceptions` directly instead of paying for a second round-trip.
 */
export async function getEffectivePermissions(
  employeeId: string,
  role: Role,
): Promise<PermissionMap> {
  const exceptions = await prisma.permissionException.findMany({
    where: { employeeId },
    select: { permissionKey: true, allowed: true },
  });
  return applyExceptions(role, exceptions);
}
