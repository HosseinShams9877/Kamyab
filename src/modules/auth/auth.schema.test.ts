import { describe, it, expect } from "vitest";
import { loginSchema } from "./auth.schema";

describe("loginSchema (C-1)", () => {
  it("accepts a valid 11-digit 09 mobile and 8+ char password", () => {
    const r = loginSchema.safeParse({
      mobile: "09123456789",
      password: "Admin@1404",
    });
    expect(r.success).toBe(true);
  });

  it("normalizes Persian digits in the mobile to ASCII", () => {
    const r = loginSchema.safeParse({
      mobile: "۰۹۱۲۳۴۵۶۷۸۹",
      password: "password1",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mobile).toBe("09123456789");
  });

  it("trims surrounding whitespace in the mobile", () => {
    const r = loginSchema.safeParse({
      mobile: "  09123456789  ",
      password: "password1",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mobile).toBe("09123456789");
  });

  it("rejects a mobile that does not start with 09", () => {
    const r = loginSchema.safeParse({
      mobile: "08123456789",
      password: "password1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a mobile of the wrong length", () => {
    const r = loginSchema.safeParse({ mobile: "0912345", password: "password1" });
    expect(r.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const r = loginSchema.safeParse({ mobile: "09123456789", password: "short" });
    expect(r.success).toBe(false);
  });
});
