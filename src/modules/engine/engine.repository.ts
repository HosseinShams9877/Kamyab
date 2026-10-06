import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  AlertIntent,
  EngineRunResult,
  GreetingIntent,
  QueuedSms,
  ReminderIntent,
  SmsLogRow,
} from "./engine.types";

// ALL engine-OWNED Prisma access lives here.

const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

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
    if (isUniqueError(e)) return false;
    throw e;
  }
}

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
    if (isUniqueError(e)) return false;
    throw e;
  }
}

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

export async function listQueuedSms(): Promise<QueuedSms[]> {
  return prisma.smsMessage.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, recipient: true, body: true },
  });
}

export async function markSmsSent(id: string): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), error: null },
  });
}

export async function markSmsFailed(id: string, error: string): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: { status: "FAILED", error },
  });
}

export async function writeRunLog(result: EngineRunResult, now: Date): Promise<void> {
  const detail = JSON.stringify({
    overdueAlerts: result.overdueAlerts,
    unfollowedAlerts: result.unfollowedAlerts,
    errorDetails: result.errorDetails,
    campaignsProcessed: result.campaignsProcessed,
    campaignsSent: result.campaignsSent,
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

// ---------------------------------------------------------------------------
// SMS log (C-14)
// ---------------------------------------------------------------------------

export async function countSmsByStatus(): Promise<Record<string, number>> {
  const groups = await prisma.smsMessage.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

export async function listRecentSmsMessages(limit = 30): Promise<SmsLogRow[]> {
  const rows = await prisma.smsMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      recipient: true,
      body: true,
      templateKey: true,
      status: true,
      error: true,
      createdAt: true,
      sentAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    body: r.body,
    templateKey: r.templateKey,
    status: r.status as "QUEUED" | "SENT" | "FAILED",
    error: r.error,
    createdAt: r.createdAt,
    sentAt: r.sentAt,
  }));
}

// ---------------------------------------------------------------------------
// Campaign ports (used by the campaign orchestrator)
// ---------------------------------------------------------------------------

/** Queue an SMS for the campaign dispatcher. Returns the new row's id. */
export async function queueSms(args: {
  recipient: string;
  body: string;
  templateKey: string;
}): Promise<{ id: string }> {
  const r = await prisma.smsMessage.create({
    data: {
      recipient: args.recipient,
      body: args.body,
      templateKey: args.templateKey,
      status: "QUEUED",
    },
    select: { id: true },
  });
  return r;
}

/** Create a notification for a customer's most recent case owner (or the first
 *  active manager if the customer has no case). */
export async function createCampaignNotification(args: {
  customerId: string;
  message: string;
}): Promise<{ id: string } | null> {
  const latestCase = await prisma.case.findFirst({
    where: { customerId: args.customerId },
    orderBy: { createdAt: "desc" },
    select: { ownerId: true },
  });
  let userId = latestCase?.ownerId;
  if (!userId) {
    const mgr = await prisma.employee.findFirst({
      where: { role: "MANAGER", status: true },
      select: { id: true },
    });
    userId = mgr?.id;
  }
  if (!userId) return null;
  return prisma.notification.create({
    data: { userId, message: args.message },
    select: { id: true },
  });
}