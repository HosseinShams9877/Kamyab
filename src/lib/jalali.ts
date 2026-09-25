import {
  toJalaali,
  toGregorian,
  jalaaliMonthLength,
  isLeapJalaaliYear,
  isValidJalaaliDate,
} from "jalaali-js";
import { toPersianDigits, toEnglishDigits } from "./digits";

// Jalali (Shamsi) calendar helpers.
//
// CRITICAL RULE (see docs/knowledge/07-critical-rules.md, rule 10): date math is
// done by CALENDAR MONTHS, never by adding a fixed number of days. When the
// source day does not exist in the target month, the day is CLAMPED to the last
// day of that month (e.g. 31 Farvardin + 6 months -> 30 Mehr, because Mehr has
// only 30 days). Never roll over into the next month.

export interface JalaliDate {
  jy: number;
  jm: number; // 1-12
  jd: number; // 1-31
}

/** Convert a JavaScript Date (local time) to its Jalali parts. */
export function toJalali(date: Date): JalaliDate {
  const { jy, jm, jd } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return { jy, jm, jd };
}

/** Convert Jalali parts to a JavaScript Date at local midnight. */
export function toGregorianDate(j: JalaliDate): Date {
  const { gy, gm, gd } = toGregorian(j.jy, j.jm, j.jd);
  return new Date(gy, gm - 1, gd);
}

/** Number of days in a given Jalali month. */
export function monthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

/** Whether a Jalali year is a leap year (Esfand has 30 days). */
export function isLeapYear(jy: number): boolean {
  return isLeapJalaaliYear(jy);
}

/** Validate Jalali parts. */
export function isValid(j: JalaliDate): boolean {
  return isValidJalaaliDate(j.jy, j.jm, j.jd);
}

/**
 * Add (or subtract, with a negative value) a number of whole months to a Jalali
 * date, clamping the day to the last valid day of the resulting month.
 */
export function addMonths(j: JalaliDate, months: number): JalaliDate {
  // Work in a zero-based month index so year arithmetic is clean. Floor division
  // handles the year borrow for negative months; the modulo is normalized to a
  // non-negative remainder so we do NOT adjust the year a second time.
  const monthIndex = j.jm - 1 + months;
  const jy = j.jy + Math.floor(monthIndex / 12);
  const jm = (((monthIndex % 12) + 12) % 12) + 1; // 1-based, always 1..12

  const maxDay = jalaaliMonthLength(jy, jm);
  const jd = Math.min(j.jd, maxDay); // clamp, never overflow into next month
  return { jy, jm, jd };
}

/** Add (or subtract) whole years, clamped the same way as addMonths. */
export function addYears(j: JalaliDate, years: number): JalaliDate {
  return addMonths(j, years * 12);
}

/** Today's date in the Jalali calendar (local time). */
export function todayJalali(): JalaliDate {
  return toJalali(new Date());
}

/**
 * Parse a Jalali date written as "YYYY/MM/DD" (Persian or ASCII digits, single-
 * or double-padded month/day) into its parts, or null when the string is not a
 * well-formed, valid Jalali date. Whitespace is trimmed and digits normalized.
 */
export function parseJalali(input: string): JalaliDate | null {
  const s = toEnglishDigits(input).trim();
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (!m) return null;
  const j: JalaliDate = { jy: Number(m[1]), jm: Number(m[2]), jd: Number(m[3]) };
  return isValid(j) ? j : null;
}

/**
 * Compare two Jalali dates by (year, month, day). Returns a negative number when
 * `a` is earlier than `b`, zero when equal, a positive number when later.
 */
export function compareJalali(a: JalaliDate, b: JalaliDate): number {
  return a.jy - b.jy || a.jm - b.jm || a.jd - b.jd;
}

/** Whether a Jalali date is strictly after today (used for "not in the future"). */
export function isFutureJalali(j: JalaliDate): boolean {
  return compareJalali(j, todayJalali()) > 0;
}

/**
 * Format a Jalali date as "YYYY/MM/DD". By default digits are Persian; pass
 * `{ persianDigits: false }` for ASCII digits (e.g. for keys or tests).
 */
export function formatJalali(
  j: JalaliDate,
  options: { persianDigits?: boolean } = {},
): string {
  const { persianDigits = true } = options;
  const yyyy = String(j.jy).padStart(4, "0");
  const mm = String(j.jm).padStart(2, "0");
  const dd = String(j.jd).padStart(2, "0");
  const ascii = `${yyyy}/${mm}/${dd}`;
  return persianDigits ? toPersianDigits(ascii) : ascii;
}
