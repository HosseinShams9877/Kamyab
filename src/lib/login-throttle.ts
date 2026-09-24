// In-memory login throttle: 5 consecutive failed attempts from one mobile lock
// that mobile for 15 minutes (C-1). Kept as a pure, side-effect-free module (no
// Next.js or Prisma imports) so it is directly unit-testable and reusable.
//
// SCOPE / LIMITATION: state lives in this process's memory. It resets on server
// restart and is NOT shared across multiple instances. That is acceptable for a
// single-instance internal tool; a multi-instance deployment should move this to
// a shared store (a DB table or Redis). See the Phase 3 report's open issues.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

type AttemptRecord = {
  failures: number;
  lockedUntil: number | null; // epoch ms, or null when not locked
};

const attempts = new Map<string, AttemptRecord>();

export type LockoutState = {
  locked: boolean;
  /** Milliseconds until the lock lifts; 0 when not locked. */
  retryAfterMs: number;
};

/**
 * Report whether a mobile is currently locked out. Also lazily clears an
 * expired lock so the next attempt starts a fresh count.
 */
export function checkLockout(mobile: string, now: number = Date.now()): LockoutState {
  const rec = attempts.get(mobile);
  if (!rec || rec.lockedUntil === null) {
    return { locked: false, retryAfterMs: 0 };
  }
  if (now >= rec.lockedUntil) {
    // Lock expired — reset so the user gets a clean slate.
    attempts.delete(mobile);
    return { locked: false, retryAfterMs: 0 };
  }
  return { locked: true, retryAfterMs: rec.lockedUntil - now };
}

/**
 * Record one failed attempt. When the count reaches the limit, the mobile is
 * locked for LOCKOUT_MS. Returns the resulting lockout state.
 */
export function registerFailedAttempt(
  mobile: string,
  now: number = Date.now(),
): LockoutState {
  // If a prior lock has expired, start over.
  const existing = attempts.get(mobile);
  const rec: AttemptRecord =
    existing && !(existing.lockedUntil !== null && now >= existing.lockedUntil)
      ? existing
      : { failures: 0, lockedUntil: null };

  rec.failures += 1;
  if (rec.failures >= MAX_FAILED_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(mobile, rec);

  return rec.lockedUntil !== null && now < rec.lockedUntil
    ? { locked: true, retryAfterMs: rec.lockedUntil - now }
    : { locked: false, retryAfterMs: 0 };
}

/** Clear all recorded attempts for a mobile (called on successful login). */
export function clearAttempts(mobile: string): void {
  attempts.delete(mobile);
}

/** Test-only: wipe the entire throttle state. */
export function _resetThrottle(): void {
  attempts.clear();
}

export const throttleConfig = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MS,
} as const;
