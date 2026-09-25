import type { CustomerType } from "@/types/enums";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

// PURE decision logic for the customers domain (C-3 guards). No I/O, no Prisma —
// every fact is passed in, so these are trivially unit-testable and the same
// rules cannot drift between call sites. All are isomorphic (client-safe), so
// the schema leaf and the client form can import them directly.

/**
 * Validate an Iranian national ID (کد ملی) by its control digit. Accepts a
 * 10-digit string (Persian/ASCII digits); rejects the wrong length and the
 * degenerate all-identical-digits sequences that pass the arithmetic but are
 * never issued. The algorithm: weight digits 0..8 by (10 - index), take the
 * remainder mod 11; the check digit must equal that remainder when it is < 2,
 * else 11 minus it.
 */
export function isValidNationalId(input: string): boolean {
  const s = toEnglishDigits(input).trim();
  if (!/^\d{10}$/.test(s)) return false;
  // All-identical digits (e.g. "1111111111") satisfy the checksum but are invalid.
  if (/^(\d)\1{9}$/.test(s)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(s[i]) * (10 - i);
  }
  const remainder = sum % 11;
  const check = Number(s[9]);
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/**
 * The name shown for a customer: the person's full name (natural) or the company
 * name (legal). Falls back to the immutable code should a name be missing.
 */
export function customerDisplayName(c: {
  type: CustomerType;
  fullName: string | null;
  companyName: string | null;
  code?: string;
}): string {
  const name = c.type === "LEGAL" ? c.companyName : c.fullName;
  return (name && name.trim()) || c.code || "";
}

/** Persian message when a mobile number already belongs to another customer. */
export function buildMobileTakenMessage(existingName: string): string {
  return `این شماره قبلاً ثبت شده: ${existingName}`;
}

/**
 * Persian message when delete is blocked because the customer has cases, e.g.
 * "این مشتری ۳ پرونده دارد." The count is only ever shown when it is > 0.
 */
export function buildDeleteBlockedMessage(caseCount: number): string {
  return `این مشتری ${toPersianDigits(String(caseCount))} پرونده دارد.`;
}
