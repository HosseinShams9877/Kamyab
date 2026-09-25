import { describe, it, expect } from "vitest";
import {
  canDeleteDuration,
  durationEditViolation,
  isUniqueViolation,
  PathRuleError,
} from "../paths.guards";

// Pure guard tests for the paths domain (B-2, B-3). No mocks needed.

describe("canDeleteDuration", () => {
  it("blocks delete only when the duration is in use", () => {
    expect(canDeleteDuration(false)).toBe(true);
    expect(canDeleteDuration(true)).toBe(false);
  });
});

describe("durationEditViolation", () => {
  const current = { monthCount: 12, isDefault: true };

  it("allows any edit when the duration is unused", () => {
    expect(
      durationEditViolation(false, current, { monthCount: 24, isDefault: false }),
    ).toBeNull();
  });

  it("allows a title-only edit (frozen fields unchanged) when in use", () => {
    expect(
      durationEditViolation(true, current, { monthCount: 12, isDefault: true }),
    ).toBeNull();
  });

  it("blocks a month-count change when in use", () => {
    expect(
      durationEditViolation(true, current, { monthCount: 24, isDefault: true }),
    ).not.toBeNull();
  });

  it("blocks a default-flag change when in use", () => {
    expect(
      durationEditViolation(true, current, { monthCount: 12, isDefault: false }),
    ).not.toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("is true only for a P2002 Prisma error", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("PathRuleError", () => {
  it("carries a name and an optional field", () => {
    const err = new PathRuleError("پیام", "title");
    expect(err.name).toBe("PathRuleError");
    expect(err.field).toBe("title");
  });
});
