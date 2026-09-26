import { describe, it, expect } from "vitest";
import { recordResultSchema } from "../followups.schema";
import { NOTE_MAX, NEXT_TITLE_MIN, NEXT_TITLE_MAX } from "../followups.guards";

// Shared validation for the record-result action (C-11 / B-6). The same object
// validates in the browser (the record-result form) and on the server (the API
// route), so these tests pin the field rules a hand-crafted request must not
// bypass (rule 3): the mandatory result, the note length, and the next-task
// due date that becomes required only when a next task is requested.

function resultInput(overrides: Record<string, unknown> = {}) {
  return {
    resultId: "result-1",
    note: "",
    nextTask: false,
    nextTaskTitle: "",
    nextTaskDueDate: "",
    ...overrides,
  };
}

/** The `path` of the first validation issue, for asserting which field failed. */
function firstErrorPath(input: unknown): string | undefined {
  const res = recordResultSchema.safeParse(input);
  if (res.success) return undefined;
  return res.error.issues[0]?.path.join(".");
}

describe("recordResultSchema — result", () => {
  it("accepts a minimal valid input (result only)", () => {
    expect(recordResultSchema.safeParse(resultInput()).success).toBe(true);
  });

  it("requires a result", () => {
    expect(firstErrorPath(resultInput({ resultId: "" }))).toBe("resultId");
  });
});

describe("recordResultSchema — note", () => {
  it("accepts a note at the length limit", () => {
    expect(recordResultSchema.safeParse(resultInput({ note: "x".repeat(NOTE_MAX) })).success).toBe(true);
  });

  it("rejects a note over the length limit", () => {
    expect(firstErrorPath(resultInput({ note: "x".repeat(NOTE_MAX + 1) }))).toBe("note");
  });
});

describe("recordResultSchema — next task", () => {
  it("ignores the next-task fields when no next task is requested", () => {
    expect(recordResultSchema.safeParse(resultInput({ nextTask: false, nextTaskDueDate: "" })).success).toBe(true);
  });

  it("requires a due date when a next task is requested", () => {
    expect(firstErrorPath(resultInput({ nextTask: true, nextTaskDueDate: "" }))).toBe("nextTaskDueDate");
  });

  it("rejects an invalid next-task due date", () => {
    expect(firstErrorPath(resultInput({ nextTask: true, nextTaskDueDate: "not-a-date" }))).toBe("nextTaskDueDate");
  });

  it("accepts a valid next-task due date (title falls back to the closed task)", () => {
    expect(
      recordResultSchema.safeParse(
        resultInput({ nextTask: true, nextTaskDueDate: "1403/06/20" }),
      ).success,
    ).toBe(true);
  });

  it("rejects a next-task title shorter than the minimum", () => {
    expect(
      firstErrorPath(
        resultInput({ nextTask: true, nextTaskDueDate: "1403/06/20", nextTaskTitle: "x".repeat(NEXT_TITLE_MIN - 1) }),
      ),
    ).toBe("nextTaskTitle");
  });

  it("accepts a next-task title at the maximum length", () => {
    expect(
      recordResultSchema.safeParse(
        resultInput({ nextTask: true, nextTaskDueDate: "1403/06/20", nextTaskTitle: "x".repeat(NEXT_TITLE_MAX) }),
      ).success,
    ).toBe(true);
  });
});
