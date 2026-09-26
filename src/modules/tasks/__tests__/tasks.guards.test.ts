import { describe, it, expect } from "vitest";
import type { JalaliDate } from "@/lib/jalali";
import { isOverdue } from "../tasks.guards";

// Pure C-11 rule: a task is overdue only while OPEN and not archived, and only
// when its Jalali due date is strictly before today (rule 2 — computed live,
// never stored). These tests pin every branch the tasks view and panel rely on.

const j = (jy: number, jm: number, jd: number): JalaliDate => ({ jy, jm, jd });

const TODAY = j(1403, 6, 15);
const PAST = j(1403, 6, 14);
const FUTURE = j(1403, 6, 16);

describe("isOverdue", () => {
  it("is true when an open, un-archived task's due date is before today", () => {
    expect(isOverdue(PAST, TODAY, "OPEN", false)).toBe(true);
  });

  it("is false when the due date is today (due today is not yet overdue)", () => {
    expect(isOverdue(TODAY, TODAY, "OPEN", false)).toBe(false);
  });

  it("is false when the due date is in the future", () => {
    expect(isOverdue(FUTURE, TODAY, "OPEN", false)).toBe(false);
  });

  it("is false for a completed task even when its due date has passed", () => {
    expect(isOverdue(PAST, TODAY, "COMPLETED", false)).toBe(false);
  });

  it("is false for a cancelled task even when its due date has passed", () => {
    expect(isOverdue(PAST, TODAY, "CANCELLED", false)).toBe(false);
  });

  it("is false for an archived task even when open and past due", () => {
    expect(isOverdue(PAST, TODAY, "OPEN", true)).toBe(false);
  });

  it("compares by full date, not just the year", () => {
    expect(isOverdue(j(1402, 12, 29), j(1403, 1, 1), "OPEN", false)).toBe(true);
    expect(isOverdue(j(1403, 1, 1), j(1402, 12, 29), "OPEN", false)).toBe(false);
  });
});
