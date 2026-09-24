import type { Role } from "@/types/enums";

// The server-side permission guard (critical rule 3: access control is enforced
// on the server, never by hiding buttons). This module is PURE — no Prisma, no
// next/*, no I/O — so it is fully unit-testable and safe to import anywhere.
//
// The permission model has three parts:
//   1. A fixed CATALOG of fine-grained permission keys ("module.action"),
//      derived one-to-one from the C-12 matrix in docs/knowledge/05-pages-fields.md.
//   2. ROLE_DEFAULTS: the starting permission map for each of the three base
//      roles (docs/knowledge/03-principles.md — roles are a *starting point*,
//      fully configurable per employee).
//   3. Effective permissions = role default OVERRIDDEN by per-employee
//      exceptions. The database stores ONLY the differences (PermissionException),
//      never the whole set (database-schema.md), so `applyExceptions` reconstructs
//      the full map from a role + its stored exception rows.

// ---------------------------------------------------------------------------
// 1) Catalog — the complete, fixed set of permission keys (C-12).
// ---------------------------------------------------------------------------

export const PERMISSION_KEYS = [
  // Customers
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.deactivate",
  // Cases — note the deliberate view_all vs view_own split (owner scoping).
  "cases.view_all",
  "cases.view_own",
  "cases.create",
  "cases.edit",
  "cases.assign_owner",
  "cases.cancel",
  "cases.restore",
  // Stages
  "stages.advance",
  "stages.add_exceptional",
  // Financial
  "financial.view",
  "financial.record_payment", // "record and delete receipts"
  "financial.adjust_total",
  // Tasks — also has the view_all vs view_own split.
  "tasks.view_all",
  "tasks.view_own",
  "tasks.create",
  "tasks.assign",
  "tasks.record_result",
  "tasks.archive",
  "tasks.delete",
  // Renewals
  "renewals.view",
  "renewals.record_followup",
  "renewals.register",
  "renewals.restore",
  // Services
  "services.view",
  "services.edit",
  // Employees
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.change_permissions",
  // Settings
  "settings.view",
  "settings.edit",
  // Reports
  "reports.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A complete permission map: every catalog key mapped to a boolean. */
export type PermissionMap = Record<PermissionKey, boolean>;

/** Resources whose access is scoped by ownership (the view_all / view_own split). */
export const OWNERSHIP_SCOPED_RESOURCES = ["cases", "tasks"] as const;
type OwnershipScopedResource = (typeof OWNERSHIP_SCOPED_RESOURCES)[number];

// ---------------------------------------------------------------------------
// 2) Role defaults.
// ---------------------------------------------------------------------------

/** Build a full map where the listed keys are `true` and every other key is `false`. */
function mapWithTrue(trueKeys: readonly PermissionKey[]): PermissionMap {
  const set = new Set<PermissionKey>(trueKeys);
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, set.has(k)]),
  ) as PermissionMap;
}

/** Every catalog key set to `true` (used for the Manager default). */
function mapAllTrue(): PermissionMap {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, true]),
  ) as PermissionMap;
}

// Manager: full access to everything by default.
const MANAGER_DEFAULTS: PermissionMap = mapAllTrue();

// Supervisor: everything EXCEPT managing employees and editing settings — those
// stay with the manager. (Still fully overridable per employee.)
const SUPERVISOR_DEFAULTS: PermissionMap = {
  ...mapAllTrue(),
  "employees.create": false,
  "employees.edit": false,
  "employees.change_permissions": false,
  "settings.edit": false,
};

// Employee: owner-scoped day-to-day work. Sees and acts on their OWN cases and
// tasks (view_own, not view_all); no administrative or destructive actions.
const EMPLOYEE_DEFAULTS: PermissionMap = mapWithTrue([
  "customers.view",
  "customers.create",
  "customers.edit",
  "cases.view_own",
  "cases.create",
  "cases.edit",
  "stages.advance",
  "financial.view",
  "tasks.view_own",
  "tasks.create",
  "tasks.record_result",
  "renewals.view",
  "renewals.record_followup",
  "services.view",
]);

export const ROLE_DEFAULTS: Record<Role, PermissionMap> = {
  MANAGER: MANAGER_DEFAULTS,
  SUPERVISOR: SUPERVISOR_DEFAULTS,
  EMPLOYEE: EMPLOYEE_DEFAULTS,
};

/** A fresh copy of a role's default map (never hand out the shared object). */
export function roleDefaults(role: Role): PermissionMap {
  return { ...ROLE_DEFAULTS[role] };
}

// ---------------------------------------------------------------------------
// 3) Effective permissions = role default overridden by stored exceptions.
// ---------------------------------------------------------------------------

/** A stored per-employee override (the shape of a PermissionException row). */
export type PermissionExceptionRow = {
  permissionKey: string;
  allowed: boolean;
};

/**
 * Reconstruct the full effective permission map from a role and the employee's
 * stored exception rows. Exceptions hold only the DIFFERENCES from the default;
 * each one overrides its key. Unknown keys (e.g. left over from a renamed
 * permission) are ignored rather than widening the map.
 */
export function applyExceptions(
  role: Role,
  exceptions: readonly PermissionExceptionRow[],
): PermissionMap {
  const map = roleDefaults(role);
  const known = new Set<string>(PERMISSION_KEYS);
  for (const ex of exceptions) {
    if (known.has(ex.permissionKey)) {
      map[ex.permissionKey as PermissionKey] = ex.allowed;
    }
  }
  return map;
}

/**
 * Merge a partial desired map (the permission-matrix payload may omit keys) onto
 * the role default, producing a COMPLETE map. Unknown keys are ignored so a stale
 * or hand-crafted payload cannot introduce keys outside the catalog.
 */
export function mergeWithDefaults(
  role: Role,
  desired: Record<string, boolean>,
): PermissionMap {
  const map = roleDefaults(role);
  const known = new Set<string>(PERMISSION_KEYS);
  for (const [key, value] of Object.entries(desired)) {
    if (known.has(key)) map[key as PermissionKey] = value;
  }
  return map;
}

/**
 * Compute the exception rows to STORE for an employee: given a role and a desired
 * full map, return only the keys whose value differs from the role default.
 * Storing only differences keeps PermissionException minimal (database-schema.md)
 * and lets a later change to a role default flow through automatically.
 */
export function computeExceptions(
  role: Role,
  desired: PermissionMap,
): PermissionExceptionRow[] {
  const defaults = ROLE_DEFAULTS[role];
  const rows: PermissionExceptionRow[] = [];
  for (const key of PERMISSION_KEYS) {
    if (desired[key] !== defaults[key]) {
      rows.push({ permissionKey: key, allowed: desired[key] });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The guard itself.
// ---------------------------------------------------------------------------

/** The minimum an authenticated actor must carry to be authorized. */
export type Authorizable = {
  id: string;
  permissions: PermissionMap;
};

/** A record that has an owner, for record-level ownership checks. */
export type OwnedRecord = { ownerId: string };

function resourceOf(action: PermissionKey): string {
  return action.slice(0, action.indexOf("."));
}

/**
 * The server-side guard (critical rule 3). Returns whether `user` may perform
 * `action`, optionally against a specific `record`.
 *
 * - Without a record: a plain lookup in the effective permission map.
 * - With a record on an ownership-scoped resource (cases, tasks): if the user
 *   lacks the resource's `view_all` permission, they may act ONLY on records
 *   they own. This is what turns "view own" into real per-record enforcement.
 */
export function can(
  user: Authorizable,
  action: PermissionKey,
  record?: OwnedRecord,
): boolean {
  if (!user.permissions[action]) return false;
  if (!record) return true;

  const resource = resourceOf(action);
  if ((OWNERSHIP_SCOPED_RESOURCES as readonly string[]).includes(resource)) {
    const viewAll = `${resource}.view_all` as PermissionKey;
    if (!user.permissions[viewAll]) {
      return record.ownerId === user.id;
    }
  }
  return true;
}

/**
 * Produce the ownership filter for a list query on an ownership-scoped resource
 * (critical rule 3 at the query level — "view all vs view own").
 *
 * - `{}`                  → may see every record (has view_all).
 * - `{ ownerId: user.id }`→ may see only their own (view_own without view_all).
 * - `null`                → may see nothing; the caller must refuse (403).
 *
 * The `{ ownerId }` fragment is meant to be spread into a Prisma `where`.
 */
export function scopeByOwnership(
  user: Authorizable,
  resource: OwnershipScopedResource,
): { ownerId: string } | Record<string, never> | null {
  if (user.permissions[`${resource}.view_all` as PermissionKey]) return {};
  if (user.permissions[`${resource}.view_own` as PermissionKey]) {
    return { ownerId: user.id };
  }
  return null;
}
