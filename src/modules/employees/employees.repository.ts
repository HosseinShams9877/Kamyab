import { prisma } from "@/lib/db";
import type { Role } from "@/types/enums";
import type {
  DepartmentOption,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeOption,
  Workload,
  WorkloadRow,
} from "./employees.types";

// ALL Prisma access for the employees domain lives here.

export async function listEmployees(): Promise<EmployeeListItem[]> {
  const rows = await prisma.employee.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      department: { select: { title: true } },
      _count: {
        select: { ownedCases: { where: { status: { in: ["NEW", "IN_PROGRESS"] } } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    mobile: r.mobile,
    email: r.email,
    role: r.role as Role,
    status: r.status,
    departmentTitle: r.department?.title ?? null,
    activeCases: r._count.ownedCases,
    createdAt: r.createdAt.toISOString(),
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

export function findEmployeeIdByMobile(mobile: string): Promise<{ id: string } | null> {
  return prisma.employee.findUnique({ where: { mobile }, select: { id: true } });
}

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

export async function reactivateEmployee(id: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { status: true } });
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { passwordHash } });
}

export function countOtherActiveManagers(excludeId: string): Promise<number> {
  return prisma.employee.count({
    where: { role: "MANAGER", status: true, id: { not: excludeId } },
  });
}

export async function findActiveManagerIds(): Promise<string[]> {
  const rows = await prisma.employee.findMany({
    where: { role: "MANAGER", status: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function countWorkload(ownerId: string): Promise<Workload> {
  const [activeCases, openTasks] = await Promise.all([
    prisma.case.count({ where: { ownerId, status: { in: ["NEW", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { ownerId, status: "OPEN" } }),
  ]);
  return { activeCases, openTasks };
}

export async function listActiveEmployees(excludeId?: string): Promise<EmployeeOption[]> {
  return prisma.employee.findMany({
    where: { status: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}

const ACTIVE_CASE_STATUSES = ["NEW", "IN_PROGRESS"];

export async function listWorkloads(
  todayStart: Date,
  tomorrowStart: Date,
): Promise<WorkloadRow[]> {
  const [employees, activeCases, todaysTasks, overdueTasks] = await Promise.all([
    prisma.employee.findMany({
      where: { status: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, department: { select: { title: true } } },
    }),
    prisma.case.groupBy({
      by: ["ownerId"],
      where: { status: { in: ACTIVE_CASE_STATUSES } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["ownerId"],
      where: {
        status: "OPEN",
        archivedAt: null,
        dueDate: { gte: todayStart, lt: tomorrowStart },
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["ownerId"],
      where: { status: "OPEN", archivedAt: null, dueDate: { lt: todayStart } },
      _count: { _all: true },
    }),
  ]);

  const countBy = (
    rows: { ownerId: string; _count: { _all: number } }[],
  ): Map<string, number> => new Map(rows.map((r) => [r.ownerId, r._count._all]));
  const cases = countBy(activeCases);
  const today = countBy(todaysTasks);
  const overdue = countBy(overdueTasks);

  return employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    department: e.department?.title ?? null,
    activeCases: cases.get(e.id) ?? 0,
    todaysTasks: today.get(e.id) ?? 0,
    overdueTasks: overdue.get(e.id) ?? 0,
  }));
}

export function listActiveDepartments(): Promise<DepartmentOption[]> {
  return prisma.department.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });
}

export async function departmentExists(id: string): Promise<boolean> {
  const row = await prisma.department.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  return row !== null;
}

export async function deactivateEmployee(id: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { status: false } });
}

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

// --- Employee list stats (C-12 header) --------------------------------------

export function countActiveEmployees(): Promise<number> {
  return prisma.employee.count({ where: { status: true } });
}

export function countInactiveEmployees(): Promise<number> {
  return prisma.employee.count({ where: { status: false } });
}

/** Distinct role values in use across all employees. */
export async function countDistinctRoles(): Promise<number> {
  const rows = await prisma.employee.findMany({
    distinct: ["role"],
    select: { role: true },
  });
  return rows.length;
}

/** Total stored permission exceptions (overrides from the role default). */
export function countPermissionExceptions(): Promise<number> {
  return prisma.permissionException.count();
}