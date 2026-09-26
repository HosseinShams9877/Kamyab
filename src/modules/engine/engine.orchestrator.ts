import { toJalali } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";
import { renderTemplate } from "@/modules/settings/lib/sms";

import {
  OVERDUE_TASK_ALERT_THRESHOLD,
  UNFOLLOWED_RENEWAL_WINDOW_DAYS,
  isBirthdayToday,
  isReminderDue,
  overdueTasksAlertMessage,
  overdueTasksAlertPrefix,
  renewalReminderMessage,
  unfollowedRenewalMessage,
  unfollowedRenewalPrefix,
} from "./engine.guards";
import type {
  EnginePorts,
  EngineRunResult,
  GreetingIntent,
  ReminderCandidate,
  ReminderIntent,
} from "./engine.types";

// The pure heart of the automatic engine (C-14). executeEngine runs the seven
// scheduled tasks against the injected EnginePorts and returns the run's tallies.
// It has NO Prisma and NO module-barrel imports — only the pure guards/text
// (engine.guards), the isomorphic template renderer, and the Jalali/digit leaves
// — so the "run twice, no duplicates" proof (engine.orchestrator.test) drives it
// with an in-memory fake that models the two DB unique indexes. Every decision
// lives here; every side-effect is a port method. The "once per period / once per
// year" guarantee is NOT re-checked here: dispatchReminder / dispatchGreeting
// return false when the unique index already holds the row, and the orchestrator
// simply does not count a false as a fresh dispatch.

/** The 24-hour window for managerial anti-repeat alerts, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run the whole engine once. Each task is isolated in its own try/catch so a
 * failure in one (a bad row, a provider hiccup) is recorded and the rest still
 * run; the tallies — including per-task error details — are persisted via
 * writeRunLog before the result is returned, so every run is logged (rule: the
 * /engine page always has the run to show).
 */
export async function executeEngine(ports: EnginePorts, now: Date): Promise<EngineRunResult> {
  const result: EngineRunResult = {
    reminders: 0,
    archived: 0,
    abandoned: 0,
    greetings: 0,
    smsSent: 0,
    errors: 0,
    overdueAlerts: 0,
    unfollowedAlerts: 0,
    errorDetails: [],
  };

  /** Run one task, folding any throw into the error tally instead of aborting. */
  const runTask = async (label: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      result.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      result.errorDetails.push(`${label}: ${message}`);
    }
  };

  const { config, managerIds } = ports;

  // --- Task 1: renewal reminders -------------------------------------------
  await runTask("reminders", async () => {
    const candidates = await ports.listReminderCandidates();
    for (const candidate of candidates) {
      if (candidate.daysRemaining === null) continue; // no expiry ⇒ nothing to time
      for (const rule of candidate.rules) {
        if (!isReminderDue(candidate.daysRemaining, rule.daysBefore)) continue;
        const intent = buildReminderIntent(candidate, rule, managerIds, config, now);
        if (!intent) continue; // no resolvable recipient (e.g. CUSTOMER on a notification)
        // false ⇒ the SentReminder unique index already holds this row → not fresh.
        if (await ports.dispatchReminder(intent)) result.reminders += 1;
      }
    }
  });

  // --- Task 2: overdue-task alerts to managers (24h anti-repeat) ------------
  await runTask("overdueAlerts", async () => {
    if (managerIds.length === 0) return;
    const owners = await ports.listOverdueOwners();
    for (const owner of owners) {
      if (owner.count < OVERDUE_TASK_ALERT_THRESHOLD) continue;
      const created = await ports.createAlertIfAbsent({
        userIds: managerIds,
        message: overdueTasksAlertMessage(owner.ownerName, owner.count),
        dedupePrefix: overdueTasksAlertPrefix(owner.ownerName),
      });
      if (created > 0) result.overdueAlerts += 1;
    }
  });

  // --- Task 3: uncontacted near-expiry renewals nudge the owner ------------
  await runTask("unfollowedAlerts", async () => {
    const renewals = await ports.listUnfollowedRenewals();
    for (const renewal of renewals) {
      if (renewal.daysRemaining > UNFOLLOWED_RENEWAL_WINDOW_DAYS) continue;
      const created = await ports.createAlertIfAbsent({
        userIds: [renewal.ownerId],
        message: unfollowedRenewalMessage(renewal.caseNumber, renewal.daysRemaining),
        dedupePrefix: unfollowedRenewalPrefix(renewal.caseNumber),
      });
      if (created > 0) result.unfollowedAlerts += 1;
    }
  });

  // --- Task 4: archive long-closed tasks -----------------------------------
  await runTask("archive", async () => {
    const cutoff = new Date(now.getTime() - config.archiveDays * DAY_MS);
    result.archived = await ports.archiveClosedTasksBefore(cutoff);
  });

  // --- Task 5: abandon expired, un-renewed periods -------------------------
  await runTask("abandon", async () => {
    result.abandoned = await ports.abandonExpiredPeriods();
  });

  // --- Task 6: birthday / founding-day greetings (once per year) -----------
  await runTask("greetings", async () => {
    // Once a day, at (or after) the configured hour — never four times a day.
    if (!config.birthday.enabled) return;
    if (now.getHours() < config.birthday.sendHour) return;
    const today = toJalali(now);
    const candidates = await ports.listGreetingCandidates();
    for (const candidate of candidates) {
      if (!candidate.birth) continue;
      if (!isBirthdayToday(candidate.birth, today)) continue;
      if (!candidate.mobile) continue;
      const intent = buildGreetingIntent(candidate, today.jy, config);
      // false ⇒ the BirthdayLog unique index already holds this year → not fresh.
      if (await ports.dispatchGreeting(intent)) result.greetings += 1;
    }
  });

  // --- Task 7: process the SMS queue (only when real sending is on) --------
  await runTask("sms", async () => {
    if (!config.realSend) return; // off ⇒ built + recorded (QUEUED) but never sent
    const queued = await ports.listQueuedSms();
    for (const msg of queued) {
      const sent = await ports.sendSms({ recipient: msg.recipient, body: msg.body });
      if (sent.ok) {
        await ports.markSmsSent(msg.id);
        result.smsSent += 1;
      } else {
        await ports.markSmsFailed(msg.id, sent.error ?? "خطای نامشخص در ارسال پیامک.");
      }
    }
  });

  // Every run is logged, whatever happened above.
  await ports.writeRunLog(result);
  return result;
}

/**
 * Resolve a due rule into a persistable reminder, or null when it has no valid
 * recipient (e.g. a CUSTOMER recipient on an internal-notification channel, or an
 * SMS to a customer with no mobile). The Persian text is composed here so the
 * repository only writes rows.
 */
function buildReminderIntent(
  candidate: ReminderCandidate,
  rule: { id: string; channel: string; recipient: string },
  managerIds: string[],
  config: { instituteName: string; templates: Record<string, string> },
  now: Date,
): ReminderIntent | null {
  const templateKey = "renewal_reminder";
  const base = {
    periodId: candidate.periodId,
    ruleId: rule.id,
    channel: rule.channel,
    notificationMessage: renewalReminderMessage(candidate.caseNumber, candidate.serviceName),
    templateKey,
  };

  if (rule.channel === "SMS_TO_CUSTOMER") {
    if (!candidate.customer.mobile) return null;
    const body = renderTemplate(config.templates[templateKey] ?? "", {
      customerName: candidate.customer.fullName ?? "",
      companyName: candidate.customer.companyName ?? "",
      serviceName: candidate.serviceName,
      expiryDate: candidate.expiryJalali ? toPersianDigits(candidate.expiryJalali) : "",
      daysRemaining: candidate.daysRemaining === null ? "" : toPersianDigits(String(candidate.daysRemaining)),
      caseNumber: toPersianDigits(candidate.caseNumber),
      instituteName: config.instituteName,
    });
    return { ...base, userIds: [], smsRecipient: candidate.customer.mobile, smsBody: body };
  }

  // INTERNAL_NOTIFICATION — resolve the recipient to concrete user ids.
  const userIds = resolveNotificationRecipients(rule.recipient, candidate.ownerId, managerIds);
  if (userIds.length === 0) return null; // e.g. CUSTOMER has no user account
  void now; // reserved for future time-scoped variants; kept for signature stability
  return { ...base, userIds, smsRecipient: null, smsBody: null };
}

/** Map a rule's recipient code onto the user ids that should be notified. */
function resolveNotificationRecipients(
  recipient: string,
  ownerId: string,
  managerIds: string[],
): string[] {
  switch (recipient) {
    case "ALL_MANAGERS":
      return managerIds;
    case "CASE_OWNER":
      return [ownerId];
    default:
      return []; // CUSTOMER (or unknown) is not an internal-notification target
  }
}

/** Resolve a birthday match into a persistable greeting (BirthdayLog + queued SMS). */
function buildGreetingIntent(
  candidate: { customerId: string; type: string; fullName: string | null; companyName: string | null; mobile: string },
  year: number,
  config: { instituteName: string; templates: Record<string, string> },
): GreetingIntent {
  const templateKey = candidate.type === "LEGAL" ? "birthday_legal" : "birthday_natural";
  const smsBody = renderTemplate(config.templates[templateKey] ?? "", {
    customerName: candidate.fullName ?? "",
    companyName: candidate.companyName ?? "",
    instituteName: config.instituteName,
  });
  return {
    customerId: candidate.customerId,
    year,
    templateKey,
    smsRecipient: candidate.mobile,
    smsBody,
  };
}
