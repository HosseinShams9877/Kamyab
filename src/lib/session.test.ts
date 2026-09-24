import { describe, it, expect, beforeAll } from "vitest";
import {
  signSession,
  verifySession,
  SESSION_DURATION_MS,
} from "./session";

// A valid secret must exist for the HMAC to work; set one for the test run.
beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-value-1234567890-abcdefghij";
});

describe("session tokens", () => {
  it("round-trips a signed session back to the user id", () => {
    const token = signSession("emp_123");
    expect(verifySession(token)).toEqual({ userId: "emp_123" });
  });

  it("rejects a tampered payload", () => {
    const token = signSession("emp_123");
    const [payload, sig] = token.split(".");
    // Flip a character in the payload; the signature no longer matches.
    const forged = `${payload}x.${sig}`;
    expect(verifySession(forged)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signSession("emp_123");
    const [payload] = token.split(".");
    expect(verifySession(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const now = Date.now();
    const token = signSession("emp_123", now);
    // Evaluate just past the 12-hour lifetime.
    const later = now + SESSION_DURATION_MS + 1;
    expect(verifySession(token, later)).toBeNull();
  });

  it("accepts a session just before expiry", () => {
    const now = Date.now();
    const token = signSession("emp_123", now);
    const justBefore = now + SESSION_DURATION_MS - 1000;
    expect(verifySession(token, justBefore)).toEqual({ userId: "emp_123" });
  });

  it("returns null for missing or malformed tokens", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("no-dot-here")).toBeNull();
    expect(verifySession(".onlysig")).toBeNull();
  });
});
