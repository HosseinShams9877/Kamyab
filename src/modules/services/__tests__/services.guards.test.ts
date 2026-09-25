import { describe, it, expect } from "vitest";
import {
  canDeleteService,
  buildServiceHasCasesMessage,
  isUniqueViolation,
  ServiceRuleError,
} from "../services.guards";

// Pure guard tests for the services domain (B-1). No mocks needed.

describe("canDeleteService", () => {
  it("allows delete only when no case exists", () => {
    expect(canDeleteService(0)).toBe(true);
    expect(canDeleteService(1)).toBe(false);
    expect(canDeleteService(42)).toBe(false);
  });
});

describe("buildServiceHasCasesMessage", () => {
  it("reports the count in Persian digits and offers deactivation", () => {
    const msg = buildServiceHasCasesMessage(14);
    expect(msg).toContain("۱۴");
    expect(msg).toContain("غیرفعال");
  });
});

describe("isUniqueViolation", () => {
  it("is true only for a P2002 Prisma error", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2003" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("ServiceRuleError", () => {
  it("carries a name and an optional field", () => {
    const err = new ServiceRuleError("پیام", "name");
    expect(err.name).toBe("ServiceRuleError");
    expect(err.field).toBe("name");
    expect(err).toBeInstanceOf(Error);
  });
});
