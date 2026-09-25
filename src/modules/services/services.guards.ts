import { toPersianDigits } from "@/lib/digits";

// PURE decision logic + Persian message builders for the services domain. No I/O,
// no Prisma — every fact needed is passed in, so these are trivially unit-testable.

/** Thrown by the service layer for a business-rule violation (mapped to 409). */
export class ServiceRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ServiceRuleError";
    this.field = field;
  }
}

/** True when a Prisma error is a unique-constraint violation (duplicate name). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * A service may be hard-deleted only when no case has ever been built from it
 * (B-1). Otherwise it can only be deactivated.
 */
export function canDeleteService(caseCount: number): boolean {
  return caseCount === 0;
}

/** Message shown when a used service's delete is refused (B-1). */
export function buildServiceHasCasesMessage(caseCount: number): string {
  return `این خدمت ${toPersianDigits(
    String(caseCount),
  )} پرونده دارد و قابل حذف نیست؛ می‌توانید آن را غیرفعال کنید.`;
}
