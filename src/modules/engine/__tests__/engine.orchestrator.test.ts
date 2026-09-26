import { describe, it, expect } from "vitest";
import { toJalali } from "@/lib/jalali";
import { executeEngine } from "../engine.orchestrator";
import type {
  EngineConfig,
  EnginePorts,
  EngineRunResult,
  GreetingCandidate,
  OverdueOwner,
  QueuedSms,
  ReminderCandidate,
  UnfollowedRenewal,
} from "../engine.types";

// The C-14 proof: run the WHOLE engine twice against one in-memory state and show
// that nothing double-fires. The fake below models the two production DB unique
// indexes (SentReminder → a Set of periodId|ruleId|channel; BirthdayLog → a Set of
// customerId|year) and the 24h anti-repeat (Notification prefix + createdAt window),
// exactly as the real repository does — so a second run within the window adds NO
// fresh reminders, greetings or alerts, archives/abandons nothing already handled,
// sends no SMS twice, and yet is STILL logged. It also proves a MISSED run is made
// up: a candidate already past its window (daysRemaining < 0, "≤") is reminded on
// the first run it is seen. Pure over EnginePorts — no Prisma, no clock coupling.

const DAY_MS = 24 * 60 * 60 * 1000;

type FakeTask = {
  status: string;
  closedAt: Date;
  archivedAt: Date | null;
};
type FakePeriod = { status: string; abandonable: boolean };
type FakeSms = {
  id: string;
  recipient: string;
  body: string;
  templateKey: string;
  status: string;
  error?: string;
};
type FakeNotification = { userId: string; message: string; createdAt: Date };

/** Data seeded into a fake run. The candidate lists stay constant across runs
 *  (the real seams re-list them every run; dedupe is the ports' job, not the
 *  list's), so re-running exercises the "once" guarantees, not a shrinking input. */
type Seed = {
  reminderCandidates: ReminderCandidate[];
  overdueOwners: OverdueOwner[];
  unfollowedRenewals: UnfollowedRenewal[];
  greetingCandidates: GreetingCandidate[];
  tasks: FakeTask[];
  periods: FakePeriod[];
};

/** An in-memory EnginePorts that faithfully models both unique indexes, the 24h
 *  anti-repeat window, and the SMS queue. State persists across executeEngine
 *  calls on the same instance, which is the whole point of the twice-run proof. */
class FakePorts implements EnginePorts {
  readonly config: EngineConfig;
  readonly managerIds: string[];

  readonly sentReminders = new Set<string>(); // periodId|ruleId|channel
  readonly birthdayLogs = new Set<string>(); // customerId|year
  readonly notifications: FakeNotification[] = [];
  readonly sms: FakeSms[] = [];
  readonly runLogs: EngineRunResult[] = [];
  private smsSeq = 0;

  constructor(
    private readonly seed: Seed,
    private readonly now: Date,
    config: EngineConfig,
    managerIds: string[],
  ) {
    this.config = config;
    this.managerIds = managerIds;
  }

  private queueSms(recipient: string, body: string, templateKey: string): void {
    this.sms.push({
      id: `sms-${++this.smsSeq}`,
      recipient,
      body,
      templateKey,
      status: "QUEUED",
    });
  }

  async listReminderCandidates(): Promise<ReminderCandidate[]> {
    return this.seed.reminderCandidates;
  }

  async dispatchReminder(intent: {
    periodId: string;
    ruleId: string;
    channel: string;
    userIds: string[];
    notificationMessage: string;
    smsRecipient: string | null;
    smsBody: string | null;
    templateKey: string;
  }): Promise<boolean> {
    const key = `${intent.periodId}|${intent.ruleId}|${intent.channel}`;
    if (this.sentReminders.has(key)) return false; // unique index already holds it
    this.sentReminders.add(key);
    if (intent.channel === "SMS_TO_CUSTOMER") {
      if (intent.smsRecipient && intent.smsBody) {
        this.queueSms(intent.smsRecipient, intent.smsBody, intent.templateKey);
      }
    } else {
      for (const userId of intent.userIds) {
        this.notifications.push({
          userId,
          message: intent.notificationMessage,
          createdAt: this.now,
        });
      }
    }
    return true;
  }

  async listOverdueOwners(): Promise<OverdueOwner[]> {
    return this.seed.overdueOwners;
  }

  async createAlertIfAbsent(intent: {
    userIds: string[];
    message: string;
    dedupePrefix: string;
  }): Promise<number> {
    const since = this.now.getTime() - DAY_MS;
    let created = 0;
    for (const userId of intent.userIds) {
      const recent = this.notifications.some(
        (n) =>
          n.userId === userId &&
          n.message.startsWith(intent.dedupePrefix) &&
          n.createdAt.getTime() >= since,
      );
      if (recent) continue;
      this.notifications.push({ userId, message: intent.message, createdAt: this.now });
      created += 1;
    }
    return created;
  }

  async listUnfollowedRenewals(): Promise<UnfollowedRenewal[]> {
    return this.seed.unfollowedRenewals;
  }

  async archiveClosedTasksBefore(cutoff: Date): Promise<number> {
    let count = 0;
    for (const t of this.seed.tasks) {
      if (
        !t.archivedAt &&
        (t.status === "COMPLETED" || t.status === "CANCELLED") &&
        t.closedAt.getTime() < cutoff.getTime()
      ) {
        t.archivedAt = this.now;
        count += 1;
      }
    }
    return count;
  }

  async abandonExpiredPeriods(): Promise<number> {
    let count = 0;
    for (const p of this.seed.periods) {
      if (p.status === "ACTIVE" && p.abandonable) {
        p.status = "ABANDONED";
        count += 1;
      }
    }
    return count;
  }

  async listGreetingCandidates(): Promise<GreetingCandidate[]> {
    return this.seed.greetingCandidates;
  }

  async dispatchGreeting(intent: {
    customerId: string;
    year: number;
    templateKey: string;
    smsRecipient: string;
    smsBody: string;
  }): Promise<boolean> {
    const key = `${intent.customerId}|${intent.year}`;
    if (this.birthdayLogs.has(key)) return false; // already greeted this year
    this.birthdayLogs.add(key);
    this.queueSms(intent.smsRecipient, intent.smsBody, intent.templateKey);
    return true;
  }

  async listQueuedSms(): Promise<QueuedSms[]> {
    return this.sms
      .filter((m) => m.status === "QUEUED")
      .map((m) => ({ id: m.id, recipient: m.recipient, body: m.body }));
  }

  async sendSms(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }

  async markSmsSent(id: string): Promise<void> {
    const m = this.sms.find((x) => x.id === id);
    if (m) m.status = "SENT";
  }

  async markSmsFailed(id: string, error: string): Promise<void> {
    const m = this.sms.find((x) => x.id === id);
    if (m) {
      m.status = "FAILED";
      m.error = error;
    }
  }

  async writeRunLog(result: EngineRunResult): Promise<void> {
    // Store a snapshot (executeEngine mutates one object across the run).
    this.runLogs.push({ ...result, errorDetails: [...result.errorDetails] });
  }
}

const NOW = new Date(2025, 5, 15, 12, 0, 0); // local noon, a fixed reference instant
const TODAY = toJalali(NOW);
const MANAGER_IDS = ["mgr1", "mgr2"];

const CONFIG: EngineConfig = {
  instituteName: "موسسه کامیاب",
  archiveDays: 7,
  birthday: { enabled: true, sendHour: 0 }, // enabled + hour ≤ noon → greetings run
  realSend: true, // task 7 actually drains the queue
  templates: {
    renewal_reminder: "یادآوری تمدید {serviceName} پرونده {caseNumber}.",
    birthday_natural: "تولدتان مبارک {customerName}.",
    birthday_legal: "سالروز تاسیس {companyName} مبارک.",
  },
};

/** A fresh seed for each fake (arrays are mutated by archive/abandon). */
function makeSeed(): Seed {
  return {
    reminderCandidates: [
      {
        // Already PAST its window (daysRemaining < 0) → the "≤" rule makes up the
        // missed run: it is reminded the first time it is seen. Two rules: an SMS
        // to the customer and an internal note to the owner.
        periodId: "p1",
        caseNumber: "1404-1",
        ownerId: "owner1",
        daysRemaining: -5,
        expiryJalali: "1404/01/01",
        serviceName: "ثبت برند",
        customer: {
          type: "NATURAL",
          fullName: "سارا احمدی",
          companyName: null,
          mobile: "09120000001",
        },
        rules: [
          { id: "r-sms", daysBefore: 30, channel: "SMS_TO_CUSTOMER", recipient: "CUSTOMER" },
          { id: "r-note", daysBefore: 30, channel: "INTERNAL_NOTIFICATION", recipient: "CASE_OWNER" },
        ],
      },
      {
        // Not yet in window → no reminder.
        periodId: "p2",
        caseNumber: "1404-2",
        ownerId: "owner2",
        daysRemaining: 100,
        expiryJalali: "1405/01/01",
        serviceName: "ثبت شرکت",
        customer: { type: "NATURAL", fullName: "x", companyName: null, mobile: "09120000002" },
        rules: [{ id: "r2", daysBefore: 30, channel: "SMS_TO_CUSTOMER", recipient: "CUSTOMER" }],
      },
      {
        // No expiry → skipped entirely.
        periodId: "p3",
        caseNumber: "1404-3",
        ownerId: "owner3",
        daysRemaining: null,
        expiryJalali: null,
        serviceName: "y",
        customer: { type: "NATURAL", fullName: "y", companyName: null, mobile: "09120000003" },
        rules: [{ id: "r3", daysBefore: 30, channel: "SMS_TO_CUSTOMER", recipient: "CUSTOMER" }],
      },
    ],
    overdueOwners: [
      { ownerId: "emp1", ownerName: "علی رضایی", count: 5 }, // ≥3 → alert managers
      { ownerId: "emp2", ownerName: "رضا", count: 2 }, // <3 → no alert
    ],
    unfollowedRenewals: [
      { caseId: "c1", caseNumber: "1404-9", ownerId: "owner1", daysRemaining: 3 }, // ≤7 → nudge
      { caseId: "c2", caseNumber: "1404-8", ownerId: "owner2", daysRemaining: 10 }, // >7 → skip
    ],
    greetingCandidates: [
      {
        // Birthday is TODAY (month+day match) → greeted once this Jalali year.
        customerId: "cust1",
        type: "NATURAL",
        fullName: "مریم کریمی",
        companyName: null,
        mobile: "09121111111",
        birth: { jy: TODAY.jy - 20, jm: TODAY.jm, jd: TODAY.jd },
      },
      {
        // A different day → not today.
        customerId: "cust2",
        type: "LEGAL",
        fullName: null,
        companyName: "شرکت الف",
        mobile: "09122222222",
        birth: { jy: TODAY.jy - 5, jm: TODAY.jm, jd: (TODAY.jd % 28) + 1 },
      },
    ],
    tasks: [
      { status: "COMPLETED", closedAt: new Date(NOW.getTime() - 10 * DAY_MS), archivedAt: null }, // old → archived
      { status: "CANCELLED", closedAt: new Date(NOW.getTime() - 2 * DAY_MS), archivedAt: null }, // recent → kept
      { status: "COMPLETED", closedAt: new Date(NOW.getTime() - 30 * DAY_MS), archivedAt: NOW }, // already archived
    ],
    periods: [
      { status: "ACTIVE", abandonable: true }, // → abandoned
      { status: "ACTIVE", abandonable: false }, // → kept
      { status: "ABANDONED", abandonable: true }, // already abandoned
    ],
  };
}

describe("executeEngine — the twice-run, no-duplicate proof (C-14)", () => {
  it("does everything on run 1, nothing fresh on run 2, and logs both", async () => {
    const ports = new FakePorts(makeSeed(), NOW, CONFIG, MANAGER_IDS);

    const first = await executeEngine(ports, NOW);
    const second = await executeEngine(ports, NOW);

    // --- Run 1 did the work -------------------------------------------------
    expect(first.errors).toBe(0);
    expect(first.reminders).toBe(2); // p1: one SMS rule + one internal rule
    expect(first.greetings).toBe(1); // cust1 only
    expect(first.overdueAlerts).toBe(1); // emp1 only (emp2 below threshold)
    expect(first.unfollowedAlerts).toBe(1); // c1 only (c2 outside window)
    expect(first.archived).toBe(1); // the 10-day-old completed task
    expect(first.abandoned).toBe(1); // the one abandonable ACTIVE period
    expect(first.smsSent).toBe(2); // reminder SMS + greeting SMS, drained by task 7

    // --- Run 2 is a no-op for every "once" guarantee ------------------------
    expect(second.errors).toBe(0);
    expect(second.reminders).toBe(0); // SentReminder index already holds both
    expect(second.greetings).toBe(0); // BirthdayLog index already holds the year
    expect(second.overdueAlerts).toBe(0); // 24h anti-repeat suppresses it
    expect(second.unfollowedAlerts).toBe(0); // 24h anti-repeat suppresses it
    expect(second.archived).toBe(0); // already archived
    expect(second.abandoned).toBe(0); // already abandoned
    expect(second.smsSent).toBe(0); // queue is empty, nothing re-queued

    // --- No duplicates in the underlying state ------------------------------
    expect(ports.sentReminders.size).toBe(2);
    expect(ports.birthdayLogs.size).toBe(1);
    expect(ports.sms.length).toBe(2); // exactly two messages were ever queued
    expect(ports.sms.every((m) => m.status === "SENT")).toBe(true);

    // Every run is logged, whatever it did (rule: /engine always has a row).
    expect(ports.runLogs.length).toBe(2);
  });

  it("with real sending OFF, messages are queued + recorded but never sent", async () => {
    const ports = new FakePorts(
      makeSeed(),
      NOW,
      { ...CONFIG, realSend: false },
      MANAGER_IDS,
    );

    const result = await executeEngine(ports, NOW);

    expect(result.reminders).toBe(2); // still built + recorded
    expect(result.greetings).toBe(1);
    expect(result.smsSent).toBe(0); // …but task 7 does not run
    expect(ports.sms.length).toBe(2);
    expect(ports.sms.every((m) => m.status === "QUEUED")).toBe(true);
    expect(ports.runLogs.length).toBe(1); // the run is still logged
  });
});


