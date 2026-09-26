import { monthLength } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";

// Pure decision logic + Persian notification text for the automatic engine (C-14).
// No Prisma, no I/O — every rule here is unit-tested directly (engine.guards.test)
// and reused by the orchestrator (engine.orchestrator.executeEngine). Keeping the
// "is it due?" / "is it a birthday today?" decisions in one pure place is rule 2:
// the exact condition the engine acts on is the one the test pins. The "once per
// period / once per year" guarantees do NOT live here — they are DB unique indexes
// (SentReminder, BirthdayLog), enforced in the repository's dispatch.

/** An employee with at least this many overdue OPEN tasks triggers a manager alert (task 2). */
export const OVERDUE_TASK_ALERT_THRESHOLD = 3;

/** A renewal with this many days left (or fewer) and no follow-up nudges its owner (task 3). */
export const UNFOLLOWED_RENEWAL_WINDOW_DAYS = 7;

/**
 * Whether a reminder rule is due for a period, from the period's days-remaining
 * (computed upstream from the stored expiry — rule 2) and the rule's `daysBefore`
 * offset (positive = before expiry, 0 = expiry day, negative = after expiry).
 *
 * The condition is a single "≤": the rule becomes due the moment we enter its
 * window and stays due until it is recorded, so a run the scheduler MISSED is
 * fully made up on the next run (rule 5). "Once per period" is then guaranteed by
 * the SentReminder unique index, never by re-checking here.
 */
export function isReminderDue(daysRemaining: number, daysBefore: number): boolean {
  return daysRemaining <= daysBefore;
}

/**
 * Whether `today` (Jalali) is the anniversary of `birth` (a birth or founding
 * date), matching on month + day only — the year is always different. A customer
 * whose date is 30 Esfand (a day that exists only in a leap year) is greeted on 29
 * Esfand in a common year, so the greeting is never silently skipped.
 */
export function isBirthdayToday(
  birth: { jm: number; jd: number },
  today: { jy: number; jm: number; jd: number },
): boolean {
  if (birth.jm === today.jm && birth.jd === today.jd) return true;
  // 30 Esfand folds onto 29 Esfand in a common year (Esfand then has 29 days).
  if (
    birth.jm === 12 &&
    birth.jd === 30 &&
    today.jm === 12 &&
    today.jd === 29 &&
    monthLength(today.jy, 12) === 29
  ) {
    return true;
  }
  return false;
}

// --- Persian notification text (one place, so it is testable + consistent) ----

/** Internal renewal-reminder notification body (channel INTERNAL_NOTIFICATION). */
export function renewalReminderMessage(caseNumber: string, serviceName: string): string {
  return `یادآوری تمدید: خدمت «${serviceName}» در پروندهٔ ${toPersianDigits(caseNumber)} به زمان تمدید نزدیک شده است.`;
}

/** Stable per-employee prefix the 24-hour overdue-task anti-repeat keys on. */
export function overdueTasksAlertPrefix(employeeName: string): string {
  return `هشدار: کارشناس «${employeeName}» کارهای عقب‌افتاده دارد`;
}

/** Full overdue-task alert (the count varies, so it comes AFTER the stable prefix). */
export function overdueTasksAlertMessage(employeeName: string, count: number): string {
  return `${overdueTasksAlertPrefix(employeeName)} (${toPersianDigits(String(count))} مورد).`;
}

/** Stable per-case prefix the 24-hour uncontacted-renewal anti-repeat keys on. */
export function unfollowedRenewalPrefix(caseNumber: string): string {
  return `یادآوری پیگیری تمدید پروندهٔ ${toPersianDigits(caseNumber)}`;
}

/** Full uncontacted-renewal nudge to the case owner. */
export function unfollowedRenewalMessage(caseNumber: string, daysRemaining: number): string {
  const days = toPersianDigits(String(Math.max(daysRemaining, 0)));
  return `${unfollowedRenewalPrefix(caseNumber)}: ${days} روز تا انقضا باقی مانده و هنوز پیگیری نشده است.`;
}
