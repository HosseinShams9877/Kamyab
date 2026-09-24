import { describe, it, expect } from "vitest";
import { formatToman, formatTomanNumber } from "../money";
import { toPersianDigits, toEnglishDigits } from "../digits";

describe("formatTomanNumber", () => {
  it("groups thousands with the Persian separator and uses Persian digits", () => {
    // ٬ = U+066C. 1500000 -> ۱٬۵۰۰٬۰۰۰
    expect(formatTomanNumber(1500000)).toBe("۱٬۵۰۰٬۰۰۰");
  });

  it("does not group numbers below 1000", () => {
    expect(formatTomanNumber(999)).toBe("۹۹۹");
  });

  it("formats zero", () => {
    expect(formatTomanNumber(0)).toBe("۰");
  });

  it("rounds fractional input (Toman is integer-only)", () => {
    expect(formatTomanNumber(1234.6)).toBe("۱٬۲۳۵");
  });

  it("keeps a leading minus for negative amounts", () => {
    expect(formatTomanNumber(-2500)).toBe("-۲٬۵۰۰");
  });
});

describe("formatToman", () => {
  it("appends the currency suffix", () => {
    expect(formatToman(2500)).toBe("۲٬۵۰۰ تومان");
  });
});

describe("digit conversion", () => {
  it("converts ASCII to Persian", () => {
    expect(toPersianDigits("2026")).toBe("۲۰۲۶");
  });
  it("converts Persian back to ASCII", () => {
    expect(toEnglishDigits("۲۰۲۶")).toBe("2026");
  });
  it("converts Arabic-Indic digits back to ASCII", () => {
    expect(toEnglishDigits("٠١٢٣")).toBe("0123");
  });
});
