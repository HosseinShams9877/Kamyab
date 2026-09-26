import { parseJalali, toGregorianDate } from "@/lib/jalali";

// Pure domain rules + Persian messages for the cases module (C-4 registration,
// C-5 page). Isomorphic leaf: no Prisma, no server-only imports — the client
// case form and the server service both use it. The register transaction and
// read-time computations (rule 2) call these helpers so the same rule is applied
// in one place.

/** A user-facing case rule failure. `field` maps the message to a form field. */
export class CaseRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "CaseRuleError";
    this.field = field;
  }
}

// --- Persian rule messages (the schema cannot express these) -----------------
export const CUSTOMER_INVALID = "مشتری انتخاب‌شده معتبر نیست.";
export const SERVICE_INVALID = "خدمت انتخاب‌شده معتبر نیست.";
export const OWNER_INVALID = "مسئول انتخاب‌شده معتبر نیست.";
/** Renewable service with no active validity duration defined (B-3). */
export const NO_DURATION_DEFINED =
  "برای این خدمت مدت اعتباری تعریف نشده است.";
export const DURATION_REQUIRED = "انتخاب مدت اعتبار الزامی است.";
export const DURATION_INVALID = "مدت اعتبار انتخاب‌شده معتبر نیست.";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from today until a Jalali expiry date: positive when the expiry is
 * ahead, negative once it has passed, null when there is no expiry (a
 * non-renewable case). Computed at read time for the header (rule 2), never
 * stored. `now` is injectable so the count is deterministic in tests.
 */
export function daysRemainingUntil(
  expiryJalali: string | null,
  now: Date = new Date(),
): number | null {
  if (!expiryJalali) return null;
  const j = parseJalali(expiryJalali);
  if (!j) return null;
  const expiry = toGregorianDate(j);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
}
