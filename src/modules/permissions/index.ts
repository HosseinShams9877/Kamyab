// Public API of the permissions module. Import permission logic from
// "@/modules/permissions" only — never reach into the guard/service/repository
// files directly from another module.

export {
  PERMISSION_KEYS,
  OWNERSHIP_SCOPED_RESOURCES,
  ROLE_DEFAULTS,
  roleDefaults,
  applyExceptions,
  mergeWithDefaults,
  computeExceptions,
  can,
  scopeByOwnership,
} from "./permissions.guard";

export {
  getEffectivePermissions,
  setEmployeePermissions,
} from "./permissions.service";

export type {
  PermissionKey,
  PermissionMap,
  Authorizable,
  OwnedRecord,
  PermissionExceptionRow,
} from "./permissions.guard";
