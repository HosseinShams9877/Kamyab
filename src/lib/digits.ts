// Digit conversion between English (0-9) and Persian (۰-۹) numerals.
// UI shows Persian digits; storage, parsing, and math always use English digits.

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ENGLISH_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Convert every ASCII digit in the input to its Persian equivalent. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Convert Persian (and Arabic-Indic) digits back to ASCII digits. */
export function toEnglishDigits(input: string): string {
  let out = input;
  for (let i = 0; i < 10; i++) {
    // Persian ۰-۹ (U+06F0..U+06F9)
    out = out.replace(new RegExp(PERSIAN_DIGITS[i], "g"), ENGLISH_DIGITS[i]);
    // Arabic-Indic ٠-٩ (U+0660..U+0669), sometimes pasted by users
    out = out.replace(
      new RegExp(String.fromCharCode(0x0660 + i), "g"),
      ENGLISH_DIGITS[i],
    );
  }
  return out;
}
