import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  checkLockout,
  clearAttempts,
  registerFailedAttempt,
} from "@/lib/login-throttle";
import type { Role } from "@/types/enums";

// Authentication business logic (kept out of the route handler per the
// services-layer rule). Enforces C-1's security properties:
//   - a single generic outcome for any bad credential (never reveal which field
//     was wrong, nor whether a mobile is registered),
//   - 5-failed-attempts → 15-minute lockout,
//   - inactive accounts cannot log in.

// A fixed valid bcrypt hash compared against when the mobile is unknown, so the
// "no such user" path costs the same time as the "wrong password" path and does
// not leak account existence through response timing. Its plaintext is
// irrelevant — a real attempt never matches it.
const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export type AuthResult =
  | { ok: true; user: { id: string; fullName: string; role: Role } }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterMs: number };

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

  const employee = await prisma.employee.findUnique({
    where: { mobile },
    select: {
      id: true,
      fullName: true,
      role: true,
      status: true,
      passwordHash: true,
    },
  });

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
