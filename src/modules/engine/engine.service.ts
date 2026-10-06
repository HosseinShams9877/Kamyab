import { formatJalali, toJalali } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";
import { createSmsGateway } from "@/lib/sms";

import * as periods from "@/modules/periods";
import * as tasks from "@/modules/tasks";
import * as customers from "@/modules/customers";
import * as employees from "@/modules/employees";
import * as settings from "@/modules/settings";
import * as campaigns from "@/modules/campaigns";
import { getStageSettings } from "@/modules/cases";

import { executeEngine } from "./engine.orchestrator";
import * as repo from "./engine.repository";
import type {
  EngineConfig,
  EnginePorts,
  EngineRunResult,
  SmsLogView,
  StageSettings,
} from "./engine.types";

// Production wiring for the automatic engine (C-14).

export async function buildRealPorts(now: Date): Promise<EnginePorts> {
  const [
    instituteName,
    thresholds,
    birthday,
    gateway,
    apiKey,
    templateRows,
    managerIds,
    stageSettings,
  ] = await Promise.all([
    settings.getInstituteName(),
    settings.getThresholds(),
    settings.getBirthday(),
    settings.getGateway(),
    settings.getSetting<string>("sms_api_key"),
    settings.listTemplates(),
    employees.listActiveManagerIds(),
    getStageSettings(),
  ]);

  const templates: Record<string, string> = {};
  for (const t of templateRows) templates[t.eventKey] = t.body;

  const stage: StageSettings = {
    enabled: stageSettings.enabled,
    daysBefore: stageSettings.daysBefore,
    channels: stageSettings.channels,
    recipients: stageSettings.recipients,
    autoPrompt: stageSettings.autoPrompt,
    notificationTemplate: stageSettings.notificationTemplate,
    smsTemplate: stageSettings.smsTemplate,
  };

  const config: EngineConfig = {
    instituteName,
    archiveDays: thresholds.archiveDays,
    birthday: { enabled: birthday.enabled, sendHour: birthday.sendHour },
    realSend: gateway.realSend,
    templates,
    stage,
  };

  const smsGateway = createSmsGateway({
    provider: gateway.provider,
    apiKey: apiKey ?? "",
    senderNumber: gateway.senderNumber,
  });

  return {
    config,
    managerIds,

    listReminderCandidates: () => periods.listReminderCandidates(now),
    dispatchReminder: (intent) => repo.dispatchReminder(intent),

    listStageDueCandidates: () => periods.listStageDueCandidates(now),
    dispatchStageReminder: (intent) => repo.dispatchStageReminder(intent),

    listOverdueOwners: () => tasks.listOverdueOwners(now),
    createAlertIfAbsent: (intent) => repo.createAlertIfAbsent(intent, now),

    listUnfollowedRenewals: () => periods.listUnfollowedRenewals(now),

    archiveClosedTasksBefore: (cutoff) => tasks.archiveClosedTasksBefore(cutoff),

    abandonExpiredPeriods: () => periods.abandonExpiredPeriods(now),

    listGreetingCandidates: () => customers.listGreetingCandidates(),
    dispatchGreeting: (intent) => repo.dispatchGreeting(intent),

    // Task 6b — campaigns.
    runCampaigns: (now2) =>
      campaigns.runCampaigns(
        {
          getInstituteName: () => Promise.resolve(instituteName),
          queueSms: async ({ recipient, body, templateKey }) => {
            const created = await repo.queueSms({ recipient, body, templateKey });
            return created.id;
          },
          createNotification: async ({ customerId, message }) => {
            const created = await repo.createCampaignNotification({
              customerId,
              message,
            });
            return created?.id ?? null;
          },
        },
        now2,
      ),

    listQueuedSms: () => repo.listQueuedSms(),
    sendSms: async ({ recipient, body }) => {
      const res = await smsGateway.send({
        recipient,
        body,
        senderNumber: gateway.senderNumber,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    markSmsSent: (id) => repo.markSmsSent(id),
    markSmsFailed: (id, error) => repo.markSmsFailed(id, error),

    writeRunLog: (result) => repo.writeRunLog(result, now),
  };
}

export async function runEngine(now: Date = new Date()): Promise<EngineRunResult> {
  const ports = await buildRealPorts(now);
  return executeEngine(ports, now);
}

// --- /engine run-log view ---------------------------------------------------

export type EngineRunView = {
  id: string;
  dateJalali: string;
  time: string;
  reminders: number;
  archived: number;
  abandoned: number;
  greetings: number;
  smsSent: number;
  overdueAlerts: number;
  unfollowedAlerts: number;
  errors: number;
  errorDetails: string[];
  campaignsProcessed: number;
  campaignsSent: number;
  stageReminders: number;
};

function toRunView(row: repo.RunLogRow): EngineRunView {
  const dateJalali = formatJalali(toJalali(row.runAt), { persianDigits: true });
  const hh = String(row.runAt.getHours()).padStart(2, "0");
  const mm = String(row.runAt.getMinutes()).padStart(2, "0");
  const time = toPersianDigits(`${hh}:${mm}`);

  let overdueAlerts = 0;
  let unfollowedAlerts = 0;
  let errorDetails: string[] = [];
  let campaignsProcessed = 0;
  let campaignsSent = 0;
  let stageReminders = 0;
  if (row.detail) {
    try {
      const parsed = JSON.parse(row.detail) as {
        overdueAlerts?: number;
        unfollowedAlerts?: number;
        errorDetails?: string[];
        campaignsProcessed?: number;
        campaignsSent?: number;
        stageReminders?: number;
      };
      overdueAlerts = parsed.overdueAlerts ?? 0;
      unfollowedAlerts = parsed.unfollowedAlerts ?? 0;
      errorDetails = Array.isArray(parsed.errorDetails) ? parsed.errorDetails : [];
      campaignsProcessed = parsed.campaignsProcessed ?? 0;
      campaignsSent = parsed.campaignsSent ?? 0;
      stageReminders = parsed.stageReminders ?? 0;
    } catch {
      // ignore
    }
  }

  return {
    id: row.id,
    dateJalali,
    time,
    reminders: row.reminders,
    archived: row.archived,
    abandoned: row.abandoned,
    greetings: row.greetings,
    smsSent: row.smsSent,
    overdueAlerts,
    unfollowedAlerts,
    errors: row.errors,
    errorDetails,
    campaignsProcessed,
    campaignsSent,
    stageReminders,
  };
}

export async function listRecentRuns(limit = 50): Promise<EngineRunView[]> {
  const rows = await repo.listRecentRuns(limit);
  return rows.map(toRunView);
}

export async function getSmsLog(): Promise<SmsLogView> {
  const [counts, rows] = await Promise.all([
    repo.countSmsByStatus(),
    repo.listRecentSmsMessages(),
  ]);
  return {
    sent: counts.SENT ?? 0,
    queued: counts.QUEUED ?? 0,
    failed: counts.FAILED ?? 0,
    rows,
  };
}