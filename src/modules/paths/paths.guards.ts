// PURE decision logic + Persian message builders for the paths module (B-2, B-3).
// No I/O, no Prisma — every fact needed is passed in, so these are trivially
// unit-testable.

/** Thrown by the paths service for a business-rule violation (mapped to 409). */
export class PathRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "PathRuleError";
    this.field = field;
  }
}

/** True when a Prisma error is a unique-constraint violation (duplicate title). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * A validity duration used by any case/period cannot be deleted — it may only be
 * renamed (B-3). Delete is allowed only when the duration is unused.
 */
export function canDeleteDuration(inUse: boolean): boolean {
  return !inUse;
}

/** Message shown when a used duration's delete is refused (B-3). */
export const DURATION_IN_USE_DELETE =
  "این مدت اعتبار در پرونده‌ها استفاده شده و قابل حذف نیست؛ تنها می‌توانید عنوان آن را ویرایش کنید.";

/**
 * A used duration is rename-only: its month count (and default flag) are frozen
 * because cases already computed expiry dates from them (B-3). Returns a Persian
 * message when the requested edit changes a frozen field, otherwise null.
 */
export function durationEditViolation(
  inUse: boolean,
  current: { monthCount: number; isDefault: boolean },
  next: { monthCount: number; isDefault: boolean },
): string | null {
  if (!inUse) return null;
  if (next.monthCount !== current.monthCount) {
    return "این مدت اعتبار در پرونده‌ها استفاده شده؛ تنها عنوان آن قابل ویرایش است.";
  }
  if (next.isDefault !== current.isDefault) {
    return "این مدت اعتبار در پرونده‌ها استفاده شده؛ تنها عنوان آن قابل ویرایش است.";
  }
  return null;
}
