import { describe, it, expect, beforeEach } from "vitest";
import {
  checkLockout,
  registerFailedAttempt,
  clearAttempts,
  _resetThrottle,
  throttleConfig,
} from "./auth.throttle";

const MOBILE = "09120000000";

beforeEach(() => {
  _resetThrottle();
});

describe("login throttle (5 attempts → 15-minute lockout)", () => {
  it("is not locked with no attempts", () => {
    expect(checkLockout(MOBILE)).toEqual({ locked: false, retryAfterMs: 0 });
  });

  it("does not lock before the limit", () => {
    for (let i = 0; i < throttleConfig.MAX_FAILED_ATTEMPTS - 1; i++) {
      registerFailedAttempt(MOBILE);
    }
    expect(checkLockout(MOBILE).locked).toBe(false);
  });

  it("locks on the fifth consecutive failure for 15 minutes", () => {
    let state = { locked: false, retryAfterMs: 0 };
    for (let i = 0; i < throttleConfig.MAX_FAILED_ATTEMPTS; i++) {
      state = registerFailedAttempt(MOBILE);
    }
    expect(state.locked).toBe(true);
    expect(state.retryAfterMs).toBeGreaterThan(0);
    expect(state.retryAfterMs).toBeLessThanOrEqual(throttleConfig.LOCKOUT_MS);
    expect(checkLockout(MOBILE).locked).toBe(true);
  });

  it("clears the lock once the 15 minutes elapse and starts a fresh count", () => {
    const now = 1_000_000;
    for (let i = 0; i < throttleConfig.MAX_FAILED_ATTEMPTS; i++) {
      registerFailedAttempt(MOBILE, now);
    }
    expect(checkLockout(MOBILE, now).locked).toBe(true);

    const afterExpiry = now + throttleConfig.LOCKOUT_MS + 1;
    expect(checkLockout(MOBILE, afterExpiry).locked).toBe(false);
    // A new failure after expiry does not immediately re-lock.
    expect(registerFailedAttempt(MOBILE, afterExpiry).locked).toBe(false);
  });

  it("clearAttempts resets the counter (successful login)", () => {
    for (let i = 0; i < throttleConfig.MAX_FAILED_ATTEMPTS - 1; i++) {
      registerFailedAttempt(MOBILE);
    }
    clearAttempts(MOBILE);
    // One more failure should count as the first, not the fifth.
    expect(registerFailedAttempt(MOBILE).locked).toBe(false);
  });

  it("tracks mobiles independently", () => {
    for (let i = 0; i < throttleConfig.MAX_FAILED_ATTEMPTS; i++) {
      registerFailedAttempt("09120000000");
    }
    expect(checkLockout("09120000000").locked).toBe(true);
    expect(checkLockout("09350000000").locked).toBe(false);
  });
});
