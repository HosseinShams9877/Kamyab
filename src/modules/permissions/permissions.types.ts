// Public type surface for the permissions module. The definitions live with the
// pure guard (where PermissionKey is derived from the PERMISSION_KEYS catalog);
// this file re-exports them so consumers can import types from one obvious place.
export type {
  PermissionKey,
  PermissionMap,
  Authorizable,
  OwnedRecord,
  PermissionExceptionRow,
} from "./permissions.guard";
