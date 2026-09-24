import { prisma } from "@/lib/db";

// Data access for the auth domain. The only place that reads the Employee table
// for authentication and session resolution. Other modules go through
// auth.service, never this repository.

/** Look up an employee by mobile (the username) for credential verification. */
export function findEmployeeByMobile(mobile: string) {
  return prisma.employee.findUnique({
    where: { mobile },
    select: {
      id: true,
      fullName: true,
      role: true,
      status: true,
      passwordHash: true,
    },
  });
}

/** Look up an employee by id for per-request session resolution (no secrets). */
export function findEmployeeById(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    select: { id: true, fullName: true, role: true, status: true },
  });
}
