import { formatJalali, toJalali } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";
import { createSmsGateway } from "@/lib/sms";

import * as periods from "@/modules/periods";
import * as tasks from "@/modules/tasks";
import * as customers from "@/modules/customers";
import * as employees from "@/modules/employees";
import * as settings from "@/modules/settings";

import { executeEngine } from "./engine.orchestrator";
import * as repo from "./engine.repository";
import type {
  EngineConfig,
  EnginePorts,
  EngineRunResult,
  SmsLogView,
} from "./engine.types";

// Production wiring for the automatic engine (C-14). This is the ONLY file that
// stitches the pure orchestrator (executeEngine) to the real world: it reads the
// run's configuration from settings, gathers the manager ids, builds the SMS
// gateway for the configured provider, and backs every EnginePorts method with
// the engine repository (engine-owned tables) or a downstream module's service
// seam (periods/tasks/customers/employees — rule 9, never their repositories).
// `now` is captured once per run and threaded everywhere, so a run is a single
// coherent snapshot and the twice-run proof stays deterministic.

/**
 * Assemble the live EnginePorts for a run anchored at `now`. Settings, manager
 * ids and templates are read once, up front; the SMS gateway is built for the
 * configured provider (its raw API key comes from getSetting — getGateway only
 * exposes `hasApiKey`, never the key itself). `now` is closed over by the port
 * methods that need it (candidate windows, the 24h anti-repeat, the run log).
 */
export async function buildRealPorts(now: Date): Promise<EnginePorts> {
  const [instituteName, thresholds, birthday, gateway, apiKey, templateRows, managerIds] =
    await Promise.all([
      settings.getInstituteName(),
      settings.getThresholds(),
      settings.getBirthday(),
      settings.getGateway(),
      settings.getSetting<string>("sms_api_key"),
      settings.listTemplates(),
      employees.listActiveManagerIds(),
    ]);

  const templates: Record<string, string> = {};
  for (const t of templateRows) templates[t.eventKey] = t.body;

  const config: EngineConfig = {
    instituteName,
    archiveDays: thresholds.archiveDays,
    birthday: { enabled: birthday.enabled, sendHour: birthday.sendHour },
    realSend: gateway.realSend,
    templates,
  };

  const smsGateway = createSmsGateway({
    provider: gateway.provider,
    apiKey: apiKey ?? "",
    senderNumber: gateway.senderNumber,
  });

  return {
    config,
    managerIds,

    // Task 1 — renewal reminders.
    listReminderCandidates: () => periods.listReminderCandidates(now),
    dispatchReminder: (intent) => repo.dispatchReminder(intent),

    // Task 2 — overdue-task alerts to managers (24h anti-repeat).
    listOverdueOwners: () => tasks.listOverdueOwners(now),
    createAlertIfAbsent: (intent) => repo.createAlertIfAbsent(intent, now),

    // Task 3 — uncontacted near-expiry renewals nudge the owner (24h anti-repeat).
    listUnfollowedRenewals: () => periods.listUnfollowedRenewals(now),

    // Task 4 — archive long-closed tasks.
    archiveClosedTasksBefore: (cutoff) => tasks.archiveClosedTasksBefore(cutoff),

    // Task 5 — abandon expired, un-renewed periods.
    abandonExpiredPeriods: () => periods.abandonExpiredPeriods(now),

    // Task 6 — birthday / founding-day greetings (once per year).
    listGreetingCandidates: () => customers.listGreetingCandidates(),
    dispatchGreeting: (intent) => repo.dispatchGreeting(intent),

    // Task 7 — process the SMS queue (only when real sending is on).
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

    // Persist the run's tallies (always).
    writeRunLog: (result) => repo.writeRunLog(result, now),
  };
}

/**
 * Run the whole engine once. Both entry points (POST /api/engine/run and the CLI
 * scripts/engine.ts) call THIS — there is one runner, two triggers. `now` is
 * injectable so tests can pin the reference instant; production passes none and
 * gets the wall clock.
 */
export async function runEngine(now: Date = new Date()): Promise<EngineRunResult> {
  const ports = await buildRealPorts(now);
  return executeEngine(ports, now);
}

// --- /engine run-log view ---------------------------------------------------

/** One run as the /engine page shows it: Jalali date + time (Persian digits) and
 *  the two alert counts / error details recovered from the log's `detail` JSON. */
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
};

/** Reduce a stored run row to its view, recovering the extras from `detail`. */
function toRunView(row: repo.RunLogRow): EngineRunView {
  const dateJalali = formatJalali(toJalali(row.runAt), { persianDigits: true });
  const hh = String(row.runAt.getHours()).padStart(2, "0");
  const mm = String(row.runAt.getMinutes()).padStart(2, "0");
  const time = toPersianDigits(`${hh}:${mm}`);

  let overdueAlerts = 0;
  let unfollowedAlerts = 0;
  let errorDetails: string[] = [];
  if (row.detail) {
    try {
      const parsed = JSON.parse(row.detail) as {
        overdueAlerts?: number;
        unfollowedAlerts?: number;
        errorDetails?: string[];
      };
      overdueAlerts = parsed.overdueAlerts ?? 0;
      unfollowedAlerts = parsed.unfollowedAlerts ?? 0;
      errorDetails = Array.isArray(parsed.errorDetails) ? parsed.errorDetails : [];
    } catch {
      // A malformed detail column leaves the extras at their zero defaults.
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
  };
}

/** The most recent engine runs, newest first, for the /engine page. */
export async function listRecentRuns(limit = 50): Promise<EngineRunView[]> {
  const rows = await repo.listRecentRuns(limit);
  return rows.map(toRunView);
}

// ---------------------------------------------------------------------------
// SMS log (C-14) — counts + recent rows, for the /engine page.
// ---------------------------------------------------------------------------

/** The SMS log view: counts by status + recent rows, for the engine page. */
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