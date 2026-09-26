import { describe, it, expect } from "vitest";
import { taskCreateSchema } from "../tasks.schema";
import { TITLE_MIN, TITLE_MAX, NOTE_MAX } from "../tasks.guards";

// Shared validation (C-11). The same object validates in the task form and on
// the task API routes, so these tests pin the field rules a hand-crafted request
// must not bypass (rule 3): title bounds, a real Jalali due date, the required
// owner, priority coercion, and the note length. Whether the case/owner actually
// exist and are active is a business rule the service owns (not the schema).

function taskInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "پیگیری تمدید",
    caseId: "",
    ownerId: "employee-1",
    dueDate: "1403/06/15",
    priority: "NORMAL",
    note: "",
    ...overrides,
  };
}

/** The `path` of the first validation issue, for asserting which field failed. */
function firstErrorPath(input: unknown): string | undefined {
  const res = taskCreateSchema.safeParse(input);
  if (res.success) return undefined;
  return res.error.issues[0]?.path.join(".");
}

describe("taskCreateSchema — title", () => {
  it("accepts a valid title", () => {
    expect(taskCreateSchema.safeParse(taskInput()).success).toBe(true);
  });

  it("rejects a title shorter than the minimum", () => {
    expect(firstErrorPath(taskInput({ title: "x".repeat(TITLE_MIN - 1) }))).toBe("title");
  });

  it("accepts a title at the minimum length", () => {
    expect(taskCreateSchema.safeParse(taskInput({ title: "x".repeat(TITLE_MIN) })).success).toBe(true);
  });

  it("accepts a title at the maximum length", () => {
    expect(taskCreateSchema.safeParse(taskInput({ title: "x".repeat(TITLE_MAX) })).success).toBe(true);
  });

  it("rejects a title over the maximum length", () => {
    expect(firstErrorPath(taskInput({ title: "x".repeat(TITLE_MAX + 1) }))).toBe("title");
  });
});

describe("taskCreateSchema — due date", () => {
  it("rejects a malformed due date", () => {
    expect(firstErrorPath(taskInput({ dueDate: "not-a-date" }))).toBe("dueDate");
  });

  it("rejects an impossible Jalali date", () => {
    expect(firstErrorPath(taskInput({ dueDate: "1403/13/01" }))).toBe("dueDate");
  });

  it("accepts a past due date (a task may be logged already late)", () => {
    expect(taskCreateSchema.safeParse(taskInput({ dueDate: "1400/01/01" })).success).toBe(true);
  });

  it("normalizes Persian digits in the due date", () => {
    const res = taskCreateSchema.safeParse(taskInput({ dueDate: "۱۴۰۳/۰۶/۱۵" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.dueDate).toBe("1403/06/15");
  });
});

describe("taskCreateSchema — owner, case, priority, note", () => {
  it("requires an owner", () => {
    expect(firstErrorPath(taskInput({ ownerId: "" }))).toBe("ownerId");
  });

  it("accepts an empty case (a task need not belong to a case)", () => {
    expect(taskCreateSchema.safeParse(taskInput({ caseId: "" })).success).toBe(true);
  });

  it("accepts a related case id", () => {
    expect(taskCreateSchema.safeParse(taskInput({ caseId: "case-1" })).success).toBe(true);
  });

  it("coerces an unknown priority to NORMAL", () => {
    const res = taskCreateSchema.safeParse(taskInput({ priority: "WHATEVER" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.priority).toBe("NORMAL");
  });

  it("accepts the HIGH and URGENT priorities", () => {
    expect(taskCreateSchema.safeParse(taskInput({ priority: "HIGH" })).success).toBe(true);
    expect(taskCreateSchema.safeParse(taskInput({ priority: "URGENT" })).success).toBe(true);
  });

  it("accepts a note at the length limit", () => {
    expect(taskCreateSchema.safeParse(taskInput({ note: "x".repeat(NOTE_MAX) })).success).toBe(true);
  });

  it("rejects a note over the length limit", () => {
    expect(firstErrorPath(taskInput({ note: "x".repeat(NOTE_MAX + 1) }))).toBe("note");
  });
});
