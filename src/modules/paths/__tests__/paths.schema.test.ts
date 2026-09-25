import { describe, it, expect } from "vitest";
import {
  stageCreateSchema,
  durationCreateSchema,
} from "../paths.schema";

// Schema tests for the paths domain (B-2, B-3): stage title bounds, and
// Persian→English digit normalization + range for the duration month count.

describe("stageCreateSchema", () => {
  it("accepts a valid stage", () => {
    const parsed = stageCreateSchema.parse({
      pathType: "INITIAL",
      title: "ثبت درخواست",
    });
    expect(parsed.title).toBe("ثبت درخواست");
  });

  it("rejects a title shorter than 2 characters", () => {
    expect(
      stageCreateSchema.safeParse({ pathType: "INITIAL", title: "ا" }).success,
    ).toBe(false);
  });

  it("rejects a title longer than 120 characters", () => {
    expect(
      stageCreateSchema.safeParse({
        pathType: "RENEWAL",
        title: "x".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown path type", () => {
    expect(
      stageCreateSchema.safeParse({ pathType: "OTHER", title: "مرحله" }).success,
    ).toBe(false);
  });
});

describe("durationCreateSchema", () => {
  it("normalizes Persian digits for the month count", () => {
    const parsed = durationCreateSchema.parse({
      title: "۱ ساله",
      monthCount: "۱۲",
    });
    expect(parsed.monthCount).toBe(12);
    expect(parsed.isDefault).toBe(false);
  });

  it("rejects a month count below 1", () => {
    expect(
      durationCreateSchema.safeParse({ title: "صفر", monthCount: 0 }).success,
    ).toBe(false);
  });

  it("rejects a month count above 120", () => {
    expect(
      durationCreateSchema.safeParse({ title: "زیاد", monthCount: 121 }).success,
    ).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(
      durationCreateSchema.safeParse({ title: "", monthCount: 12 }).success,
    ).toBe(false);
  });
});
