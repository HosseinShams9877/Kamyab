import { parseJalali, toGregorianDate } from "@/lib/jalali";
import type { StageStatus } from "@/types/enums";
import type { StageActionOp } from "@/modules/periods/periods.types";

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

// --- Stage engine messages (C-6) --------------------------------------------
export const CASE_CANCELLED = "پرونده لغو شده است.";
export const STAGE_NOT_FOUND = "مرحله یافت نشد.";
export const STAGE_FORBIDDEN = "شما مجاز به این اقدام نیستید.";
export const STAGE_INVALID_TRANSITION = "این اقدام برای وضعیت فعلی مرحله مجاز نیست.";
export const STAGE_REJECT_NOTE_REQUIRED = "ثبت یادداشت برای رد مرحله الزامی است.";
export const STAGE_DELETE_NOT_EXCEPTIONAL = "فقط مرحلهٔ استثنائی قابل حذف است.";
export const STAGE_DELETE_HAS_ACTION =
  "مرحله‌ای که روی آن اقدامی ثبت شده حذف نمی‌شود؛ آن را «نیازی نیست» کنید.";
export const STAGE_MOVE_NOT_EXCEPTIONAL = "فقط مرحلهٔ استثنائی جابه‌جا می‌شود.";

// --- Cancellation & restore messages (C-8) ----------------------------------
export const CANCEL_FORBIDDEN = "شما مجاز به لغو این پرونده نیستید.";
export const RESTORE_FORBIDDEN = "بازگرداندن پرونده فقط توسط مدیر امکان‌پذیر است.";
export const ALREADY_CANCELLED = "این پرونده پیش‌تر لغو شده است.";
export const CANNOT_CANCEL_COMPLETED = "پروندهٔ تکمیل‌شده قابل لغو نیست.";
export const NOT_CANCELLED = "این پرونده لغو نشده است.";
export const CANCEL_REASON_INVALID = "دلیل لغو انتخاب‌شده معتبر نیست.";

// --- Cancellation report (C-8 / B-5) ----------------------------------------
// Pure aggregation of a date-range's cancelled cases into per-reason counts,
// shared shape for the report page. Kept here (isomorphic leaf) so it is unit-
// tested without Prisma; the service maps its rows into `CancellationRow[]`.

/** One cancelled case reduced to its reason (title resolved, id kept for keys). */
export type CancellationRow = { reasonId: string | null; reasonTitle: string | null };

/** A single reason's tally in the report. */
export type CancellationReasonCount = { title: string; count: number };

/** The cancellation report: overall total + per-reason counts (desc by count). */
export type CancellationReport = { total: number; byReason: CancellationReasonCount[] };

/** Label for cases whose reason row was later removed (id present, title null). */
export const NO_REASON_LABEL = "بدون دلیل ثبت‌شده";

/** Tally cancelled-case rows by reason title, most frequent first (ties by title
 *  so the order is stable). Pure — the report page and its test both use it. */
export function aggregateCancellations(rows: CancellationRow[]): CancellationReport {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const title = r.reasonTitle ?? NO_REASON_LABEL;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const byReason = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { total: rows.length, byReason };
}

// Open = still on the path; closed = finished (Done / Not-Needed).
const OPEN_STATUSES: StageStatus[] = ["PENDING", "IN_PROGRESS", "REJECTED"];

/** Whether a C-6 status transition is legal for the stage's current status
 *  (pure — the same check runs client-side for button visibility and
 *  server-side as the real gate). */
export function isStageActionAllowed(op: StageActionOp, status: StageStatus): boolean {
  const isOpen = OPEN_STATUSES.includes(status);
  switch (op) {
    case "start":
      return status === "PENDING";
    case "done":
    case "reject":
    case "not_needed":
      return isOpen;
    case "reopen":
      return !isOpen; // DONE | NOT_NEEDED
    case "note":
      return true; // always available
  }
}

/** A stage carries a recorded action once it has left PENDING or been attempted;
 *  such a stage can no longer be deleted (only set to Not-Needed) — C-6. */
export function stageHasRecordedAction(status: StageStatus, attemptCount: number): boolean {
  return status !== "PENDING" || attemptCount > 0;
}

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
