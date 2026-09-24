import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import {
  checkLockout,
  clearAttempts,
  registerFailedAttempt,
} from "./auth.throttle";
import { readSessionCookie, verifySession } from "./auth.session";
import { findEmployeeById, findEmployeeByMobile } from "./auth.repository";
import { getEffectivePermissions } from "@/modules/permissions";
import type { AuthResult, CurrentUser } from "./auth.types";
import type { Role } from "@/types/enums";

// Authentication business logic (the services layer per the architecture rule).
// Enforces C-1's security properties:
//   - a single generic outcome for any bad credential (never reveal which field
//     was wrong, nor whether a mobile is registered),
//   - 5-failed-attempts → 15-minute lockout,
//   - inactive accounts cannot log in.
// Data access goes through auth.repository; permissions come from the
// permissions module's public service (getEffectivePermissions).

// A fixed valid bcrypt hash compared against when the mobile is unknown, so the
// "no such user" path costs the same time as the "wrong password" path and does
// not leak account existence through response timing. Its plaintext is
// irrelevant — a real attempt never matches it.
const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * Verify mobile + password. `mobile` is expected already normalized to ASCII
 * digits (the login schema does this). Never throws for a bad login — returns a
 * discriminated result the route maps to a generic response.
 */
export async function authenticate(
  mobile: string,
  password: string,
): Promise<AuthResult> {
  // 1) Lockout gate first — a locked mobile is refused without touching the DB.
  const lock = checkLockout(mobile);
  if (lock.locked) {
    return { ok: false, reason: "locked", retryAfterMs: lock.retryAfterMs };
  }

  const employee = await findEmployeeByMobile(mobile);

  // 2) Constant-time-ish password check even when the user is unknown.
  const hash = employee?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  // 3) A missing user or a wrong password is one and the same failure. Count it
  //    toward the lockout, but ALWAYS return the generic result for this attempt
  //    — even the attempt that trips the 5-failure limit. The lockout message
  //    only appears on the NEXT attempt, refused by the checkLockout gate above
  //    (so the 5th failure shows the generic error, the 6th shows the lockout).
  if (!employee || !passwordMatches) {
    registerFailedAttempt(mobile);
    return { ok: false, reason: "invalid" };
  }

  // 4) Credentials are correct. An inactive account is still refused — with the
  //    same generic result so we never disclose that the account exists but is
  //    disabled. Correct credentials are not counted toward the lockout.
  if (!employee.status) {
    return { ok: false, reason: "invalid" };
  }

  // 5) Success — reset the failure counter and hand back the user.
  clearAttempts(mobile);
  return {
    ok: true,
    user: {
      id: employee.id,
      fullName: employee.fullName,
      role: employee.role as Role,
    },
  };
}

// Server-side session resolution and role routing. This is the enforcement point
// for "an inactive user's next request is rejected" (C-1): the session cookie
// only proves *which* employee is claimed; whether they may still act is decided
// here by re-reading their current status and role from the database on every
// call. A user deactivated mid-session fails this check on their very next
// request even though their cookie is still cryptographically valid.

/**
 * Resolve the currently authenticated, still-active employee, or null.
 * Returns null when there is no cookie, the signature/expiry is invalid, the
 * employee no longer exists, or the employee has been deactivated. The effective
 * permission map is attached via the permissions module (getEffectivePermissions).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await readSessionCookie();
  const session = verifySession(token);
  if (!session) return null;

  const employee = await findEmployeeById(session.userId);

  // Inactive-user rejection (including mid-session): a deactivated account is
  // treated exactly like no session at all.
  if (!employee || !employee.status) return null;

  const role = employee.role as Role;
  return {
    id: employee.id,
    fullName: employee.fullName,
    role,
    permissions: await getEffectivePermissions(employee.id, role),
  };
}

/**
 * Require an authenticated active user in a server component; redirect to the
 * login page otherwise. Route handlers should instead branch on getCurrentUser
 * and return a 401 JSON response.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Where a role lands after login (C-1). */
export function roleRedirect(role: Role): string {
  // Manager and supervisor share the management dashboard; the employee gets
  // their own panel. The real pages are built in later phases; these paths are
  // the stable landing targets.
  return role === "EMPLOYEE" ? "/employee" : "/dashboard";
}
