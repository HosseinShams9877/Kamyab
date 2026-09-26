import { describe, it, expect } from "vitest";
import { caseCancelSchema, caseRestoreSchema } from "../cases.schema";

import type { z } from "zod";

// The C-8 cancel/restore schemas are isomorphic: the same objects validate in the
// cancel dialog and in the /api/cases/cancel · /restore routes, so a hand-crafted
// request cannot skip the mandatory-reason rule the dialog enforces (rule 3).
// These pin the field-level rules (required ids, the ≤500 note bound, empty-note
// acceptance); "is the reason active?" and "is the case cancellable?" are business
// rules the cases service owns and are not exercised here.

/** The path of the first Zod issue, or null on success. */
function firstErrorPath(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.path.join(".") ?? "");
}

/** The message of the first Zod issue, or null on success. */
function firstErrorMessage(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.message ?? "");
}

function cancel(overrides: Record<string, unknown> = {}) {
  return {
    caseId: "case_1",
    cancellationReasonId: "reason_1",
    note: "",
    ...overrides,
  };
}

describe("caseCancelSchema", () => {
  it("accepts a minimal valid cancel (empty note allowed)", () => {
    const res = caseCancelSchema.safeParse(cancel());
    expect(res.success).toBe(true);
  });

  it("requires a case id", () => {
    expect(firstErrorPath(caseCancelSchema.safeParse(cancel({ caseId: "" })))).toBe("caseId");
  });

  it("requires a cancellation reason with the field message", () => {
    const res = caseCancelSchema.safeParse(cancel({ cancellationReasonId: "" }));
    expect(firstErrorPath(res)).toBe("cancellationReasonId");
    expect(firstErrorMessage(res)).toBe("انتخاب دلیل لغو الزامی است.");
  });

  it("accepts a note at the 500-character limit", () => {
    expect(caseCancelSchema.safeParse(cancel({ note: "x".repeat(500) })).success).toBe(true);
  });

  it("rejects a note longer than the limit", () => {
    const res = caseCancelSchema.safeParse(cancel({ note: "x".repeat(501) }));
    expect(firstErrorPath(res)).toBe("note");
  });
});

describe("caseRestoreSchema", () => {
  it("accepts a case id", () => {
    expect(caseRestoreSchema.safeParse({ caseId: "case_1" }).success).toBe(true);
  });

  it("requires a case id", () => {
    expect(firstErrorPath(caseRestoreSchema.safeParse({ caseId: "" }))).toBe("caseId");
  });
});
