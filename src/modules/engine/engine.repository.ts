import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  AlertIntent,
  EngineRunResult,
  GreetingIntent,
  QueuedSms,
  ReminderIntent,
} from "./engine.types";

// ALL engine-OWNED Prisma access lives here: the tables the engine writes to
// (SentReminder, BirthdayLog, SmsMessage, EngineRunLog) plus the cross-cutting
// Notification inbox. Cross-MODULE reads (candidates, overdue owners, greeting
// customers, archiving, abandonment) do NOT live here — they go through the
// periods/tasks/customers/employees service seams and are wired in engine.service
// (rule 9). This file is called only by engine.service's buildRealPorts. Persian
// text never appears here: every message is composed upstream (engine.guards /
// the orchestrator) and handed in ready to store.

/** The 24-hour anti-repeat window for managerial/owner alerts, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** A unique-constraint violation (P2002) — the "already recorded" signal. */
function isUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Persist one due reminder. The SentReminder unique index (periodId, ruleId,
 * channel) IS the "once per period" guarantee — a duplicate raises P2002, caught
 * here to return false so the orchestrator never counts a re-run or a made-up run
 * as a fresh send. The reminder row and its effect (internal notifications OR a
 * queued SMS) commit together (rule 4); the SentReminder row is created first so
 * a duplicate aborts before any notification/SMS is written.
 */
export async function dispatchReminder(intent: ReminderIntent): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sentReminder.create({
        data: { periodId: intent.periodId, ruleId: intent.ruleId, channel: intent.channel },
      });
      if (intent.channel === "SMS_TO_CUSTOMER") {
        if (intent.smsRecipient && intent.smsBody) {
          await tx.smsMessage.create({
            data: {
              recipient: intent.smsRecipient,
              body: intent.smsBody,
              templateKey: intent.templateKey,
              status: "QUEUED",
            },
          });
        }
      } else if (intent.userIds.length > 0) {
        await tx.notification.createMany({
          data: intent.userIds.map((userId) => ({
            userId,
            message: intent.notificationMessage,
          })),
        });
      }
    });
    return true;
  } catch (e) {
    if (isUniqueError(e)) return false; // already recorded — a re-run or made-up run
    throw e;
  }
}

/**
 * Persist one birthday/founding-day greeting. The BirthdayLog unique index
 * (customerId, year) IS the "once per year" guarantee — a duplicate raises P2002,
 * caught here to return false. The log row and the queued SMS commit together
 * (rule 4); the log row is created first so a duplicate aborts before the SMS.
 */
export async function dispatchGreeting(intent: GreetingIntent): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.birthdayLog.create({
        data: { customerId: intent.customerId, year: intent.year },
      });
      await tx.smsMessage.create({
        data: {
          recipient: intent.smsRecipient,
          body: intent.smsBody,
          templateKey: intent.templateKey,
          status: "QUEUED",
        },
      });
    });
    return true;
  } catch (e) {
    if (isUniqueError(e)) return false; // already greeted this year
    throw e;
  }
}

/**
 * Create an alert for each recipient that has no identical-subject alert within
 * the last 24 hours (`now` bound by buildRealPorts). The dedupe keys on the stable
 * `dedupePrefix` — text that never varies with the count — so today's alert is
 * suppressed even though the count in the full message changed. This is the 24h
 * anti-repeat WITHOUT a dedicated table (tasks 2 & 3). Returns how many were
 * actually created, so the orchestrator counts an alert only when one landed.
 */
export async function createAlertIfAbsent(intent: AlertIntent, now: Date): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS);
  let created = 0;
  for (const userId of intent.userIds) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        message: { startsWith: intent.dedupePrefix },
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) continue;
    await prisma.notification.create({ data: { userId, message: intent.message } });
    created += 1;
  }
  return created;
}

/** QUEUED messages awaiting a provider send, oldest first (task 7). */
export async function listQueuedSms(): Promise<QueuedSms[]> {
  return prisma.smsMessage.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, recipient: true, body: true },
  });
}

/** Mark a queued message SENT (clears any stale error from a prior attempt). */
export async function markSmsSent(id: string): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), error: null },
  });
}

/** Mark a queued message FAILED, keeping the provider's error for the SMS log. */
export async function markSmsFailed(id: string, error: string): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: { status: "FAILED", error },
  });
}

/**
 * Record the run's tallies. EngineRunLog has no columns for the two alert counts
 * or the per-task error details, so they are serialized into `detail` (JSON) — the
 * /engine page reads them back from there. `now` is bound by buildRealPorts so the
 * logged time matches the run's reference instant. Every run is logged, always.
 */
export async function writeRunLog(result: EngineRunResult, now: Date): Promise<void> {
  const detail = JSON.stringify({
    overdueAlerts: result.overdueAlerts,
    unfollowedAlerts: result.unfollowedAlerts,
    errorDetails: result.errorDetails,
  });
  await prisma.engineRunLog.create({
    data: {
      runAt: now,
      reminders: result.reminders,
      archived: result.archived,
      abandoned: result.abandoned,
      greetings: result.greetings,
      smsSent: result.smsSent,
      errors: result.errors,
      detail,
    },
  });
}

/** One EngineRunLog row as stored (the /engine page reduces `detail` to counts). */
export type RunLogRow = {
  id: string;
  runAt: Date;
  reminders: number;
  archived: number;
  abandoned: number;
  greetings: number;
  smsSent: number;
  errors: number;
  detail: string | null;
};

/** The most recent runs, newest first, for the /engine run-log view. */
export function listRecentRuns(limit: number): Promise<RunLogRow[]> {
  return prisma.engineRunLog.findMany({
    orderBy: { runAt: "desc" },
    take: limit,
    select: {
      id: true,
      runAt: true,
      reminders: true,
      archived: true,
      abandoned: true,
      greetings: true,
      smsSent: true,
      errors: true,
      detail: true,
    },
  });
}
