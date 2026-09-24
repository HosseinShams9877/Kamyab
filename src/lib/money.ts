import { toPersianDigits } from "./digits";

// Money in this system is Toman, always a whole number (no decimals).
// Thousands are grouped with the Persian thousands separator ٬ (U+066C).

const THOUSANDS_SEPARATOR = "٬"; // ٬

/**
 * Group an integer amount into 3-digit blocks with the Persian thousands
 * separator, returning Persian digits. Negative amounts keep a leading minus.
 * Non-integer input is rounded to the nearest integer (Toman has no fractions).
 */
export function formatTomanNumber(amount: number): string {
  const rounded = Math.round(amount);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();

  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      grouped += THOUSANDS_SEPARATOR;
    }
    grouped += digits[i];
  }

  const persian = toPersianDigits(grouped);
  return negative ? `-${persian}` : persian;
}

/** Same as formatTomanNumber but with the Persian currency suffix "تومان". */
export function formatToman(amount: number): string {
  return `${formatTomanNumber(amount)} تومان`;
}
