import bcrypt from "bcryptjs";
import type { Role } from "@/types/enums";
import {
  getEffectivePermissions,
  roleDefaults,
  setEmployeePermissions,
  type PermissionMap,
} from "@/modules/permissions";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "./employees.schema";
import type {
  DeactivationResult,
  DepartmentOption,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeOption,
  PermissionsView,
  Workload,
} from "./employees.types";
import {
  buildSuccessorRequiredMessage,
  buildTransferNotification,
  evaluateDeactivation,
} from "./employees.guards";
import * as repo from "./employees.repository";

// Business logic for the employees domain (C-12). This service is the module's
// only cross-module entry point: it uses the permissions module through its
// public API (@/modules/permissions) and the auth module supplies the acting
// user id at the route boundary. Every multi-step write is a single transaction
// (rule 4), delegated to the repository.

const BCRYPT_ROUNDS = 10;

/** Normalize an optional text field: empty/whitespace becomes null. */
function orNull(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function listEmployees(): Promise<EmployeeListItem[]> {
  return repo.listEmployees();
}

export function getEmployee(id: string): Promise<EmployeeDetail | null> {
  return repo.findEmployeeById(id);
}

export function listDepartmentOptions(): Promise<DepartmentOption[]> {
  return repo.listActiveDepartments();
}

export function listSuccessorCandidates(excludeId: string): Promise<EmployeeOption[]> {
  return repo.listActiveEmployees(excludeId);
}

/** Active employees eligible to own a case, for the case-registration pick (C-4). */
export function listCaseOwnerOptions(): Promise<EmployeeOption[]> {
  return repo.listActiveEmployees();
}

/**
 * Create an employee. Enforces mobile uniqueness (mobile is the username) and an
 * existing/active department when one is given, then hashes the initial password
 * before storing. Returns a Persian field error instead of throwing on the two
 * expected validation failures the schema cannot catch (uniqueness, referential).
 */
export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<{ ok: true; id: string } | { ok: false; field: string; message: string }> {
  const existing = await repo.findEmployeeIdByMobile(input.mobile);
  if (existing) {
    return { ok: false, field: "mobile", message: "این شماره موبایل قبلاً ثبت شده است." };
  }
  const departmentId = orNull(input.departmentId);
  if (departmentId && !(await repo.departmentExists(departmentId))) {
    return { ok: false, field: "departmentId", message: "دپارتمان انتخاب‌شده معتبر نیست." };
  }
  const passwordHash = bcrypt.hashSync(input.password, BCRYPT_ROUNDS);
  const { id } = await repo.createEmployee({
    fullName: input.fullName,
    mobile: input.mobile,
    email: orNull(input.email),
    departmentId,
    role: input.role,
    passwordHash,
  });
  return { ok: true, id };
}

/**
 * Update an employee's profile. Mobile uniqueness is re-checked excluding the
 * employee itself; the password is never touched here (see setPassword).
 */
export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
): Promise<{ ok: true } | { ok: false; field: string; message: string }> {
  const current = await repo.findEmployeeById(id);
  if (!current) return { ok: false, field: "id", message: "کارمند یافت نشد." };

  const owner = await repo.findEmployeeIdByMobile(input.mobile);
  if (owner && owner.id !== id) {
    return { ok: false, field: "mobile", message: "این شماره موبایل قبلاً ثبت شده است." };
  }
  const departmentId = orNull(input.departmentId);
  if (departmentId && !(await repo.departmentExists(departmentId))) {
    return { ok: false, field: "departmentId", message: "دپارتمان انتخاب‌شده معتبر نیست." };
  }
  await repo.updateEmployee(id, {
    fullName: input.fullName,
    mobile: input.mobile,
    email: orNull(input.email),
    departmentId,
    role: input.role,
  });
  return { ok: true };
}

/** Reactivate a deactivated employee. Low-risk (no work to move on the way in). */
export function reactivateEmployee(id: string): Promise<void> {
  return repo.reactivateEmployee(id);
}

/**
 * Set a new password. The manager can only SET a new value — the current
 * password is a one-way hash and is never read back (C-12 rule).
 */
export async function setPassword(id: string, password: string): Promise<void> {
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  await repo.updatePasswordHash(id, passwordHash);
}

/**
 * The permission-matrix view: the employee's role default AND their current
 * effective map, so the UI can show each toggle against its default.
 */
export async function getPermissionsView(
  id: string,
  role: Role,
): Promise<PermissionsView> {
  const effective = await getEffectivePermissions(id, role);
  return { role, defaults: roleDefaults(role), effective };
}

/**
 * Persist a desired permission map for an employee. Delegates storage to the
 * permissions module (which reduces the map to stored differences); this service
 * only resolves the employee's current role first.
 */
export async function updatePermissions(
  id: string,
  desired: Record<string, boolean>,
): Promise<{ ok: true; effective: PermissionMap } | { ok: false }> {
  const employee = await repo.findEmployeeById(id);
  if (!employee) return { ok: false };
  const effective = await setEmployeePermissions(id, employee.role, desired);
  return { ok: true, effective };
}

export function getWorkload(id: string): Promise<Workload> {
  return repo.countWorkload(id);
}

/**
 * Deactivate an employee (C-12). Gathers every fact the guard needs, lets the
 * pure evaluator decide, and — when work must move — performs the transfer,
 * successor notification, and deactivation in one transaction. Never deletes.
 */
export async function deactivateEmployee(
  actorId: string,
  targetId: string,
  successorId: string | null,
): Promise<DeactivationResult> {
  const target = await repo.findEmployeeById(targetId);
  if (!target) {
    return { ok: false, reason: "already_inactive", message: "کارمند یافت نشد." };
  }

  const [otherActiveManagers, workload, successor] = await Promise.all([
    repo.countOtherActiveManagers(targetId),
    repo.countWorkload(targetId),
    successorId ? repo.findEmployeeStatus(successorId) : Promise.resolve(null),
  ]);

  const decision = evaluateDeactivation({
    actorId,
    target: { id: target.id, role: target.role, status: target.status },
    otherActiveManagers,
    workload,
    successor,
  });

  if (!decision.allowed) {
    switch (decision.reason) {
      case "self":
        return { ok: false, reason: "self", message: "شما نمی‌توانید حساب خود را غیرفعال کنید." };
      case "last_manager":
        return {
          ok: false,
          reason: "last_manager",
          message: "آخرین مدیر فعال را نمی‌توان غیرفعال کرد.",
        };
      case "already_inactive":
        return { ok: false, reason: "already_inactive", message: "این کارمند از قبل غیرفعال است." };
      case "successor_invalid":
        return {
          ok: false,
          reason: "successor_invalid",
          message: "مالک جدید انتخاب‌شده معتبر نیست.",
        };
      case "successor_required":
        return {
          ok: false,
          reason: "successor_required",
          message: buildSuccessorRequiredMessage(workload),
          workload,
        };
    }
  }

  if (decision.allowed && decision.transfer) {
    const moved = await repo.transferWorkAndDeactivate(
      target.id,
      successorId as string,
      (counts) => buildTransferNotification(target.fullName, counts),
    );
    return { ok: true, transferred: moved };
  }

  // Allowed with no work to move.
  await repo.deactivateEmployee(target.id);
  return { ok: true, transferred: { activeCases: 0, openTasks: 0 } };
}
