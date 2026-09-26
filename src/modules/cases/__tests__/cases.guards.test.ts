import { describe, it, expect } from "vitest";
import {
  aggregateCancellations,
  NO_REASON_LABEL,
  type CancellationRow,
} from "../cases.guards";

// The C-8 cancellation report reduces a date range's cancelled cases to per-reason
// counts. aggregateCancellations is the pure core (no Prisma), so the report page
// and this test share the exact tally + ordering rule: most frequent first, ties
// broken by title, and a missing reason title folded into NO_REASON_LABEL.

function rows(...reasons: (string | null)[]): CancellationRow[] {
  return reasons.map((reasonTitle) => ({
    reasonId: reasonTitle === null ? null : `r_${reasonTitle}`,
    reasonTitle,
  }));
}

describe("aggregateCancellations", () => {
  it("is empty for no rows", () => {
    expect(aggregateCancellations([])).toEqual({ total: 0, byReason: [] });
  });

  it("counts a single reason", () => {
    const report = aggregateCancellations(rows("عدم تمدید", "عدم تمدید"));
    expect(report.total).toBe(2);
    expect(report.byReason).toEqual([{ title: "عدم تمدید", count: 2 }]);
  });

  it("orders reasons by count, most frequent first", () => {
    const report = aggregateCancellations(rows("الف", "ب", "ب", "ب", "الف"));
    expect(report.total).toBe(5);
    expect(report.byReason.map((r) => r.title)).toEqual(["ب", "الف"]);
    expect(report.byReason[0]).toEqual({ title: "ب", count: 3 });
  });

  it("breaks ties by title so the order is stable", () => {
    const report = aggregateCancellations(rows("ب", "الف"));
    expect(report.byReason.map((r) => r.title)).toEqual(["الف", "ب"]);
  });

  it("folds a missing reason title into the no-reason label", () => {
    const report = aggregateCancellations(rows(null, null, "عدم تمدید"));
    const noReason = report.byReason.find((r) => r.title === NO_REASON_LABEL);
    expect(noReason?.count).toBe(2);
    expect(report.total).toBe(3);
  });
});
