import { toJalali } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";
import { renderTemplate } from "@/modules/settings/lib/sms";

import {
  OVERDUE_TASK_ALERT_THRESHOLD,
  UNFOLLOWED_RENEWAL_WINDOW_DAYS,
  isBirthdayToday,
  isReminderDue,
  isStageReminderDue,
  overdueTasksAlertMessage,
  overdueTasksAlertPrefix,
  renderStageTemplate,
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
  StageDueCandidate,
  StageReminderIntent,
  StageSettings,
} from "./engine.types";

// The pure heart of the automatic engine (C-14).

const DAY_MS = 24 * 60 * 60 * 1000;

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
    campaignsProcessed: 0,
    campaignsSent: 0,
    stageReminders: 0,
  };

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
      if (candidate.daysRemaining === null) continue;
      for (const rule of candidate.rules) {
        if (!isReminderDue(candidate.daysRemaining, rule.daysBefore)) continue;
        const intent = buildReminderIntent(candidate, rule, managerIds, config, now);
        if (!intent) continue;
        if (await ports.dispatchReminder(intent)) result.reminders += 1;
      }
    }
  });

  // --- Task 1b: stage-due reminders ----------------------------------------
  await runTask("stageReminders", async () => {
    const stageCfg = config.stage;
    if (!stageCfg.enabled) return;
    if (stageCfg.channels.length === 0 || stageCfg.recipients.length === 0) return;

    const candidates = await ports.listStageDueCandidates();
    for (const c of candidates) {
      if (!isStageReminderDue(c.daysRemaining, stageCfg.daysBefore)) continue;
      const intent = buildStageReminderIntent(c, stageCfg, managerIds, config);
      if (!intent) continue;
      if (await ports.dispatchStageReminder(intent)) result.stageReminders += 1;
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
    if (!config.birthday.enabled) return;
    if (now.getHours() < config.birthday.sendHour) return;
    const today = toJalali(now);
    const candidates = await ports.listGreetingCandidates();
    for (const candidate of candidates) {
      if (!candidate.birth) continue;
      if (!isBirthdayToday(candidate.birth, today)) continue;
      if (!candidate.mobile) continue;
      const intent = buildGreetingIntent(candidate, today.jy, config);
      if (await ports.dispatchGreeting(intent)) result.greetings += 1;
    }
  });

  // --- Task 6b: due campaigns ----------------------------------------------
  await runTask("campaigns", async () => {
    const r = await ports.runCampaigns(now);
    result.campaignsProcessed = r.campaignsProcessed;
    result.campaignsSent = r.sent;
  });

  // --- Task 7: process the SMS queue (only when real sending is on) --------
  await runTask("sms", async () => {
    if (!config.realSend) return;
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

  await ports.writeRunLog(result);
  return result;
}

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
      daysRemaining:
        candidate.daysRemaining === null ? "" : toPersianDigits(String(candidate.daysRemaining)),
      caseNumber: toPersianDigits(candidate.caseNumber),
      instituteName: config.instituteName,
    });
    return { ...base, userIds: [], smsRecipient: candidate.customer.mobile, smsBody: body };
  }

  const userIds = resolveNotificationRecipients(rule.recipient, candidate.ownerId, managerIds);
  if (userIds.length === 0) return null;
  void now;
  return { ...base, userIds, smsRecipient: null, smsBody: null };
}

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
      return [];
  }
}

function buildStageReminderIntent(
  candidate: StageDueCandidate,
  settings: StageSettings,
  managerIds: string[],
  config: { instituteName: string },
): StageReminderIntent | null {
  const customerName =
    candidate.customer.type === "LEGAL"
      ? candidate.customer.companyName ?? ""
      : candidate.customer.fullName ?? "";

  const recipientUserIds: string[] = [];
  for (const r of settings.recipients) {
    if (r === "CASE_OWNER") recipientUserIds.push(candidate.ownerId);
    else if (r === "ALL_MANAGERS") recipientUserIds.push(...managerIds);
  }
  const uniqueUserIds = Array.from(new Set(recipientUserIds));

  const notificationMessage = renderStageTemplate(settings.notificationTemplate, {
    stageTitle: candidate.stageTitle,
    caseNumber: candidate.caseNumber,
    customerName,
    daysRemaining: candidate.daysRemaining,
    instituteName: config.instituteName,
  });

  const smsBody = candidate.customer.mobile
    ? renderStageTemplate(settings.smsTemplate, {
        stageTitle: candidate.stageTitle,
        caseNumber: candidate.caseNumber,
        customerName,
        daysRemaining: candidate.daysRemaining,
        instituteName: config.instituteName,
      })
    : null;

  return {
    stageId: candidate.stageId,
    daysBefore: settings.daysBefore,
    channels: settings.channels,
    recipientUserIds: uniqueUserIds,
    notificationMessage,
    smsRecipient: candidate.customer.mobile || null,
    smsBody,
  };
}

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