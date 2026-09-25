import { describe, it, expect } from "vitest";
import {
  isValidNationalId,
  customerDisplayName,
  buildMobileTakenMessage,
  buildDeleteBlockedMessage,
} from "../customers.guards";

// Pure guard logic (C-3): the national-ID control-digit check, the display-name
// rule, and the two Persian messages. No I/O, so these are plain unit tests.

describe("isValidNationalId", () => {
  it("accepts a well-formed national ID (valid control digit)", () => {
    // 123456789 -> weighted sum 210, 210 % 11 = 1, so the check digit is 1.
    expect(isValidNationalId("1234567891")).toBe(true);
  });

  it("normalizes Persian digits before validating", () => {
    expect(isValidNationalId("۱۲۳۴۵۶۷۸۹۱")).toBe(true);
  });

  it("rejects a wrong control digit", () => {
    expect(isValidNationalId("1234567890")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidNationalId("12345")).toBe(false);
    expect(isValidNationalId("12345678901")).toBe(false);
  });

  it("rejects all-identical digits even though they satisfy the arithmetic", () => {
    expect(isValidNationalId("1111111111")).toBe(false);
    expect(isValidNationalId("0000000000")).toBe(false);
  });

  it("rejects non-digit input", () => {
    expect(isValidNationalId("12345abcde")).toBe(false);
  });
});

describe("customerDisplayName", () => {
  it("uses the full name for a natural person", () => {
    expect(
      customerDisplayName({ type: "NATURAL", fullName: "علی رضایی", companyName: null }),
    ).toBe("علی رضایی");
  });

  it("uses the company name for a legal entity", () => {
    expect(
      customerDisplayName({ type: "LEGAL", fullName: null, companyName: "شرکت نمونه" }),
    ).toBe("شرکت نمونه");
  });

  it("falls back to the code when the applicable name is missing", () => {
    expect(
      customerDisplayName({ type: "NATURAL", fullName: null, companyName: null, code: "CU-1403-0007" }),
    ).toBe("CU-1403-0007");
  });
});

describe("Persian messages", () => {
  it("builds the mobile-taken message with the existing name", () => {
    expect(buildMobileTakenMessage("علی رضایی")).toBe("این شماره قبلاً ثبت شده: علی رضایی");
  });

  it("builds the delete-blocked message with a Persian-digit count", () => {
    expect(buildDeleteBlockedMessage(3)).toBe("این مشتری ۳ پرونده دارد.");
  });
});
