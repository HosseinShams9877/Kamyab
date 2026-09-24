import { prisma } from "@/lib/db";
import type { Role } from "@/types/enums";
import type {
  DepartmentOption,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeOption,
  Workload,
} from "./employees.types";

// ALL Prisma access for the employees domain lives here (modular rule: the
// repository is the only file that touches the database for this module, and it
// is called only by employees.service). Persian text never appears in this
// layer — it deals in ids, counts, and rows.

export async function listEmployees(): Promise<EmployeeListItem[]> {
  const rows = await prisma.employee.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      role: true,
      status: true,
      department: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    mobile: r.mobile,
    role: r.role as Role,
    status: r.status,
    departmentTitle: r.department?.title ?? null,
  }));
}

export async function findEmployeeById(id: string): Promise<EmployeeDetail | null> {
  const r = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      email: true,
      departmentId: true,
      role: true,
      status: true,
    },
  });
  if (!r) return null;
  return { ...r, role: r.role as Role };
}

/** Minimal lookup for the mobile-uniqueness check (mobile is the username). */
export function findEmployeeIdByMobile(mobile: string): Promise<{ id: string } | null> {
  return prisma.employee.findUnique({ where: { mobile }, select: { id: true } });
}

/** Status of a would-be successor, for server-side successor validation. */
export function findEmployeeStatus(
  id: string,
): Promise<{ id: string; status: boolean } | null> {
  return prisma.employee.findUnique({ where: { id }, select: { id: true, status: true } });
}

export type CreateEmployeeData = {
  fullName: string;
  mobile: string;
  email: string | null;
  departmentId: string | null;
  role: Role;
  passwordHash: string;
};

export async function createEmployee(data: CreateEmployeeData): Promise<{ id: string }> {
  const row = await prisma.employee.create({ data, select: { id: true } });
  return row;
}

export type UpdateEmployeeData = {
  fullName: string;
  mobile: string;
  email: string | null;
  departmentId: string | null;
  role: Role;
};

export async function updateEmployee(id: string, data: UpdateEmployeeData): Promise<void> {
  await prisma.employee.update({ where: { id }, data });
}

/** Reactivate a previously deactivated employee (status back to true). */
export async function reactivateEmployee(id: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { status: true } });
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { passwordHash } });
}

/** Count OTHER active managers (excludes the given id) — last-manager guard. */
export function countOtherActiveManagers(excludeId: string): Promise<number> {
  return prisma.employee.count({
    where: { role: "MANAGER", status: true, id: { not: excludeId } },
  });
}

/**
 * Active workload for an employee: active cases (NEW or IN_PROGRESS) they own and
 * open tasks (OPEN) they own. Both drive the deactivation-transfer decision.
 */
export async function countWorkload(ownerId: string): Promise<Workload> {
  const [activeCases, openTasks] = await Promise.all([
    prisma.case.count({ where: { ownerId, status: { in: ["NEW", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { ownerId, status: "OPEN" } }),
  ]);
  return { activeCases, openTasks };
}

/** Active employees other than `excludeId`, for the successor / owner select. */
export async function listActiveEmployees(excludeId?: string): Promise<EmployeeOption[]> {
  return prisma.employee.findMany({
    where: { status: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}

/**
 * Active departments for the employee form's Department dropdown. This is a
 * reference read of a seeded lookup table; there is no departments module yet,
 * so no repository boundary is crossed. When a departments/settings-lists module
 * is built, this read moves behind its service (docs/roadmap/folder-structure.md).
 */
export function listActiveDepartments(): Promise<DepartmentOption[]> {
  return prisma.department.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });
}

/** True when the given department id exists and is active (create/update guard). */
export async function departmentExists(id: string): Promise<boolean> {
  const row = await prisma.department.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Deactivate an employee that has no active work — a single status update, no
 * transfer needed.
 */
export async function deactivateEmployee(id: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { status: false } });
}

/**
 * Transfer all active work from `targetId` to `successorId`, notify the
 * successor, and deactivate the target — ALL in one transaction (rule 4). The
 * Persian notification text is produced by the injected `buildMessage` so this
 * data-layer function stays free of presentation concerns. Returns the counts
 * actually moved.
 */
export async function transferWorkAndDeactivate(
  targetId: string,
  successorId: string,
  buildMessage: (moved: Workload) => string,
): Promise<Workload> {
  return prisma.$transaction(async (tx) => {
    const cases = await tx.case.updateMany({
      where: { ownerId: targetId, status: { in: ["NEW", "IN_PROGRESS"] } },
      data: { ownerId: successorId },
    });
    const tasks = await tx.task.updateMany({
      where: { ownerId: targetId, status: "OPEN" },
      data: { ownerId: successorId },
    });
    const moved: Workload = { activeCases: cases.count, openTasks: tasks.count };
    await tx.notification.create({
      data: { userId: successorId, message: buildMessage(moved) },
    });
    await tx.employee.update({ where: { id: targetId }, data: { status: false } });
    return moved;
  });
}
