import { describe, it, expect } from "vitest";
import {
  addMonths,
  addYears,
  monthLength,
  isLeapYear,
  formatJalali,
  toJalali,
  toGregorianDate,
} from "./jalali";

describe("addMonths - day clamping (critical rule 10)", () => {
  it("clamps 31 Farvardin + 6 months to 30 Mehr (Mehr has 30 days)", () => {
    // The headline clamping case: 1405/01/31 + 6 months -> 1405/07/30.
    expect(addMonths({ jy: 1405, jm: 1, jd: 31 }, 6)).toEqual({
      jy: 1405,
      jm: 7,
      jd: 30,
    });
  });

  it("clamps into a LEAP Esfand (30 days): 1403/06/31 + 6 -> 1403/12/30", () => {
    expect(isLeapYear(1403)).toBe(true);
    expect(monthLength(1403, 12)).toBe(30);
    expect(addMonths({ jy: 1403, jm: 6, jd: 31 }, 6)).toEqual({
      jy: 1403,
      jm: 12,
      jd: 30,
    });
  });

  it("clamps into a COMMON Esfand (29 days): 1404/06/31 + 6 -> 1404/12/29", () => {
    expect(isLeapYear(1404)).toBe(false);
    expect(monthLength(1404, 12)).toBe(29);
    expect(addMonths({ jy: 1404, jm: 6, jd: 31 }, 6)).toEqual({
      jy: 1404,
      jm: 12,
      jd: 29,
    });
  });

  it("does not clamp when the day already fits", () => {
    expect(addMonths({ jy: 1405, jm: 1, jd: 15 }, 6)).toEqual({
      jy: 1405,
      jm: 7,
      jd: 15,
    });
  });
});

describe("addMonths - year rollover", () => {
  it("rolls forward across the year boundary", () => {
    // Bahman (11) + 3 months -> Ordibehesht (2) of next year.
    expect(addMonths({ jy: 1405, jm: 11, jd: 15 }, 3)).toEqual({
      jy: 1406,
      jm: 2,
      jd: 15,
    });
  });

  it("rolls backward across the year boundary", () => {
    expect(addMonths({ jy: 1405, jm: 1, jd: 10 }, -1)).toEqual({
      jy: 1404,
      jm: 12,
      jd: 10,
    });
  });

  it("adding 0 months returns the same date", () => {
    expect(addMonths({ jy: 1405, jm: 5, jd: 20 }, 0)).toEqual({
      jy: 1405,
      jm: 5,
      jd: 20,
    });
  });
});

describe("addYears", () => {
  it("adds whole years (renewal period)", () => {
    expect(addYears({ jy: 1405, jm: 1, jd: 31 }, 1)).toEqual({
      jy: 1406,
      jm: 1,
      jd: 31,
    });
  });

  it("clamps a leap-day renewal onto a common year", () => {
    // 1403/12/30 (leap) + 1 year -> 1404 has no 30 Esfand -> clamp to 29.
    expect(addYears({ jy: 1403, jm: 12, jd: 30 }, 1)).toEqual({
      jy: 1404,
      jm: 12,
      jd: 29,
    });
  });
});

describe("month lengths", () => {
  it("first six months have 31 days", () => {
    for (let m = 1; m <= 6; m++) expect(monthLength(1405, m)).toBe(31);
  });
  it("months 7-11 have 30 days", () => {
    for (let m = 7; m <= 11; m++) expect(monthLength(1405, m)).toBe(30);
  });
});

describe("conversion round-trip", () => {
  it("Jalali -> Gregorian -> Jalali is stable", () => {
    const j = { jy: 1405, jm: 7, jd: 30 };
    expect(toJalali(toGregorianDate(j))).toEqual(j);
  });
});

describe("formatJalali", () => {
  it("formats with zero-padding and ASCII digits when requested", () => {
    expect(
      formatJalali({ jy: 1405, jm: 7, jd: 30 }, { persianDigits: false }),
    ).toBe("1405/07/30");
  });
  it("uses Persian digits by default", () => {
    expect(formatJalali({ jy: 1405, jm: 7, jd: 30 })).toBe("۱۴۰۵/۰۷/۳۰");
  });
});
