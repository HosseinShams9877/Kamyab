import type { Role } from "@/types/enums";
import type { PermissionMap } from "@/modules/permissions";

// Shared types for the auth module.

/**
 * Result of a credential check. A discriminated union the login route maps to a
 * generic response: "invalid" and "locked" never disclose which field was wrong
 * nor whether a mobile is registered (C-1).
 */
export type AuthResult =
  | { ok: true; user: { id: string; fullName: string; role: Role } }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterMs: number };

/**
 * The currently authenticated, still-active employee, enriched with their
 * effective permission map so every server call carries authorization data.
 */
export type CurrentUser = {
  id: string;
  fullName: string;
  role: Role;
  permissions: PermissionMap;
};
