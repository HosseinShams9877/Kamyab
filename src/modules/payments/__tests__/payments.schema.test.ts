import { describe, it, expect } from "vitest";
import { paymentCreateSchema, adjustTotalSchema } from "../payments.schema";
import { MAX_AMOUNT, MAX_NOTE } from "../payments.guards";

// Shared validation (C-7). The same objects validate in the financial panel and
// on the payment API routes, so these tests pin the field rules a hand-crafted
// request must not bypass (rule 3): amount bounds, a non-future Jalali receipt
// date, the required method/period, the note length, and the empty-total case.

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    periodId: "period-1",
    methodId: "method-1",
    amount: "500000",
    receiptDate: "1400/01/01",
    note: "",
    ...overrides,
  };
}

/** The `path` of the first validation issue, for asserting which field failed. */
function firstErrorPath(input: unknown): string | undefined {
  const res = paymentCreateSchema.safeParse(input);
  if (res.success) return undefined;
  return res.error.issues[0]?.path.join(".");
}

describe("paymentCreateSchema — amount", () => {
  it("accepts a valid whole-Toman amount and coerces to a number", () => {
    const res = paymentCreateSchema.safeParse(paymentInput());
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.amount).toBe(500000);
  });

  it("normalizes Persian digits", () => {
    const res = paymentCreateSchema.safeParse(paymentInput({ amount: "۷۵۰۰۰۰" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.amount).toBe(750000);
  });

  it("rejects zero", () => {
    expect(firstErrorPath(paymentInput({ amount: "0" }))).toBe("amount");
  });

  it("rejects a non-numeric amount", () => {
    expect(firstErrorPath(paymentInput({ amount: "12a" }))).toBe("amount");
  });

  it("rejects an amount above the cap", () => {
    expect(firstErrorPath(paymentInput({ amount: String(MAX_AMOUNT + 1) }))).toBe("amount");
  });

  it("accepts the cap exactly", () => {
    expect(paymentCreateSchema.safeParse(paymentInput({ amount: String(MAX_AMOUNT) })).success).toBe(true);
  });
});

describe("paymentCreateSchema — receipt date", () => {
  it("rejects a malformed date", () => {
    expect(firstErrorPath(paymentInput({ receiptDate: "not-a-date" }))).toBe("receiptDate");
  });

  it("rejects a future date", () => {
    expect(firstErrorPath(paymentInput({ receiptDate: "1500/01/01" }))).toBe("receiptDate");
  });

  it("accepts a past date", () => {
    expect(paymentCreateSchema.safeParse(paymentInput({ receiptDate: "1400/01/01" })).success).toBe(true);
  });
});

describe("paymentCreateSchema — method, period, note", () => {
  it("requires a method", () => {
    expect(firstErrorPath(paymentInput({ methodId: "" }))).toBe("methodId");
  });

  it("requires a period", () => {
    expect(firstErrorPath(paymentInput({ periodId: "" }))).toBe("periodId");
  });

  it("accepts a note at the length limit", () => {
    expect(paymentCreateSchema.safeParse(paymentInput({ note: "x".repeat(MAX_NOTE) })).success).toBe(true);
  });

  it("rejects a note over the length limit", () => {
    expect(firstErrorPath(paymentInput({ note: "x".repeat(MAX_NOTE + 1) }))).toBe("note");
  });
});

describe("adjustTotalSchema", () => {
  it("coerces an empty total to null (clears the agreed amount)", () => {
    const res = adjustTotalSchema.safeParse({ periodId: "period-1", totalAmount: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.totalAmount).toBeNull();
  });

  it("accepts a numeric total and coerces to a number", () => {
    const res = adjustTotalSchema.safeParse({ periodId: "period-1", totalAmount: "1000000" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.totalAmount).toBe(1000000);
  });

  it("normalizes Persian digits in the total", () => {
    const res = adjustTotalSchema.safeParse({ periodId: "period-1", totalAmount: "۲۵۰۰۰۰۰" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.totalAmount).toBe(2500000);
  });

  it("rejects a total above the cap", () => {
    expect(adjustTotalSchema.safeParse({ periodId: "period-1", totalAmount: String(MAX_AMOUNT + 1) }).success).toBe(false);
  });

  it("requires a period", () => {
    expect(adjustTotalSchema.safeParse({ periodId: "", totalAmount: "" }).success).toBe(false);
  });
});
