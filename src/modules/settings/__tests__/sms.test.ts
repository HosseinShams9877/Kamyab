import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  renderPreview,
  smsCharCount,
  smsPartCount,
} from "../lib/sms";

// Pure template helpers (B-10). No DB, no mocks.

describe("renderTemplate", () => {
  it("replaces known placeholders with their values", () => {
    expect(
      renderTemplate("سلام {customerName}", { customerName: "علی" }),
    ).toBe("سلام علی");
  });

  it("leaves an unknown placeholder untouched (never crashes, never blanks)", () => {
    expect(renderTemplate("کد {mystery} تمام", { customerName: "علی" })).toBe(
      "کد {mystery} تمام",
    );
  });

  it("replaces every occurrence and mixes known + unknown", () => {
    expect(
      renderTemplate("{a} و {a} و {b}", { a: "۱" }),
    ).toBe("۱ و ۱ و {b}");
  });
});

describe("renderPreview", () => {
  it("fills known placeholders from the sample data", () => {
    const out = renderPreview("خدمت {serviceName} برای {customerName}");
    expect(out).toContain("کارت بازرگانی");
    expect(out).toContain("علی رضایی");
    expect(out).not.toContain("{");
  });
});

describe("smsPartCount (Persian / UCS-2)", () => {
  it("counts an empty string as 0 parts", () => {
    expect(smsPartCount("")).toBe(0);
  });

  it("counts up to 70 characters as a single part", () => {
    expect(smsPartCount("a".repeat(70))).toBe(1);
  });

  it("splits beyond 70 characters into 67-char segments", () => {
    expect(smsPartCount("a".repeat(71))).toBe(2);
    expect(smsPartCount("a".repeat(134))).toBe(2);
    expect(smsPartCount("a".repeat(135))).toBe(3);
  });

  it("counts by code points, not UTF-16 units", () => {
    expect(smsCharCount("سلام")).toBe(4);
  });
});
