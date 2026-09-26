import { describe, it, expect } from "vitest";
import {
  renewalSchema,
  renewalFollowUpSchema,
  periodActionSchema,
} from "../periods.schema";
import {
  START_DATE_INVALID,
  AMOUNT_INVALID,
  AMOUNT_TOO_LARGE,
  NOTE_TOO_LONG,
  FOLLOW_UP_STATUS_REQUIRED,
  FOLLOW_UP_STATUS_INVALID,
} from "../periods.guards";

// The isomorphic C-9 renewal / renewal-follow-up schemas: the same objects run in
// the browser (the two forms) and on the server (the renewal API routes), so a
// hand-crafted request cannot skip a rule the form enforces (rule 3). These tests
// pin the field-level rules — the start-date refine, the amount normalization and
// caps, the note bound, and the required-vs-invalid follow-up status — that the
// forms and routes both rely on. The business rules (renewable? active period?
// duration exists?) belong to the cases service and are not exercised here.

import type { z } from "zod";

/** The path of the first Zod issue, or null on success — matches the sibling
 *  schema tests' style. */
function firstErrorPath(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.path.join(".") ?? "");
}

/** The message of the first Zod issue, or null on success. */
function firstErrorMessage(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.message ?? "");
}

function renewal(overrides: Record<string, unknown> = {}) {
  return {
    caseId: "case_1",
    startDate: "1404/05/01",
    durationId: "dur_1",
    renewalAmount: "",
    note: "",
    ...overrides,
  };
}

describe("renewalSchema", () => {
  it("accepts a minimal valid renewal (empty amount → null)", () => {
    const res = renewalSchema.safeParse(renewal());
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.renewalAmount).toBeNull();
      expect(res.data.caseId).toBe("case_1");
    }
  });

  it("requires a case id", () => {
    const res = renewalSchema.safeParse(renewal({ caseId: "" }));
    expect(firstErrorPath(res)).toBe("caseId");
  });

  it("rejects an unparseable start date", () => {
    const res = renewalSchema.safeParse(renewal({ startDate: "not-a-date" }));
    expect(firstErrorPath(res)).toBe("startDate");
    expect(firstErrorMessage(res)).toBe(START_DATE_INVALID);
  });

  it("normalizes Persian digits in the start date", () => {
    const res = renewalSchema.safeParse(renewal({ startDate: "۱۴۰۴/۰۵/۰۱" }));
    expect(res.success).toBe(true);
  });

  it("rejects a non-numeric amount", () => {
    const res = renewalSchema.safeParse(renewal({ renewalAmount: "12a" }));
    expect(firstErrorPath(res)).toBe("renewalAmount");
    expect(firstErrorMessage(res)).toBe(AMOUNT_INVALID);
  });

  it("rejects an amount above the cap", () => {
    const res = renewalSchema.safeParse(renewal({ renewalAmount: "2000000001" }));
    expect(firstErrorMessage(res)).toBe(AMOUNT_TOO_LARGE);
  });

  it("accepts the amount at the cap and coerces Persian digits to a number", () => {
    const res = renewalSchema.safeParse(renewal({ renewalAmount: "۵۰۰۰۰۰" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.renewalAmount).toBe(500000);
  });

  it("rejects a note longer than the limit", () => {
    const res = renewalSchema.safeParse(renewal({ note: "x".repeat(301) }));
    expect(firstErrorPath(res)).toBe("note");
    expect(firstErrorMessage(res)).toBe(NOTE_TOO_LONG);
  });
});

describe("renewalFollowUpSchema", () => {
  it("accepts a valid follow-up status", () => {
    const res = renewalFollowUpSchema.safeParse({
      caseId: "case_1",
      followUpStatus: "CONTACTED",
      note: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.followUpStatus).toBe("CONTACTED");
  });

  it("treats a blank status as 'required'", () => {
    const res = renewalFollowUpSchema.safeParse({
      caseId: "case_1",
      followUpStatus: "",
      note: "",
    });
    expect(firstErrorPath(res)).toBe("followUpStatus");
    expect(firstErrorMessage(res)).toBe(FOLLOW_UP_STATUS_REQUIRED);
  });

  it("treats an unknown status as 'invalid'", () => {
    const res = renewalFollowUpSchema.safeParse({
      caseId: "case_1",
      followUpStatus: "MAYBE_LATER",
      note: "",
    });
    expect(firstErrorPath(res)).toBe("followUpStatus");
    expect(firstErrorMessage(res)).toBe(FOLLOW_UP_STATUS_INVALID);
  });

  it("rejects a note longer than the limit", () => {
    const res = renewalFollowUpSchema.safeParse({
      caseId: "case_1",
      followUpStatus: "CONTACTED",
      note: "x".repeat(301),
    });
    expect(firstErrorMessage(res)).toBe(NOTE_TOO_LONG);
  });
});

describe("periodActionSchema", () => {
  it("accepts a period id", () => {
    expect(periodActionSchema.safeParse({ periodId: "period_1" }).success).toBe(true);
  });

  it("requires a period id", () => {
    const res = periodActionSchema.safeParse({ periodId: "" });
    expect(firstErrorPath(res)).toBe("periodId");
  });
});
