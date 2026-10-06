// Isomorphic contract for the automatic engine (C-14): the dependency-injection
// port the orchestrator runs against, plus the candidate / intent / result shapes
// the ports exchange. No Prisma types leak in here — executeEngine is pure over
// this interface, so the "run twice, no duplicates" proof drives it with an
// in-memory fake (engine.orchestrator.test) that models the two DB unique indexes
// (SentReminder, BirthdayLog). The production wiring backs the same interface with
// the engine repository + the periods/tasks/customers/employees service seams
// (engine.service). Nothing imports this module — the engine sits at the top of
// the module DAG and only ever reads downward.

/** One active reminder rule of a candidate period's service. */
export type ReminderRuleView = {
  id: string;
  daysBefore: number; // +before / 0 on expiry / −after (the "≤" window offset)
  channel: string; // INTERNAL_NOTIFICATION | SMS_TO_CUSTOMER
  recipient: string; // CASE_OWNER | ALL_MANAGERS | CUSTOMER
};

/** An ACTIVE period of a non-cancelled case whose service has ≥1 active rule. */
export type ReminderCandidate = {
  periodId: string;
  caseNumber: string;
  ownerId: string;
  daysRemaining: number | null;
  expiryJalali: string | null;
  serviceName: string;
  customer: {
    type: string;
    fullName: string | null;
    companyName: string | null;
    mobile: string;
  };
  rules: ReminderRuleView[];
};

/** A fully-resolved reminder ready to persist. */
export type ReminderIntent = {
  periodId: string;
  ruleId: string;
  channel: string;
  userIds: string[];
  notificationMessage: string;
  smsRecipient: string | null;
  smsBody: string | null;
  templateKey: string;
};

/** An employee and their current count of overdue OPEN tasks. */
export type OverdueOwner = { ownerId: string; ownerName: string; count: number };

/** An ACTIVE, not-yet-followed-up renewal with its computed days-remaining. */
export type UnfollowedRenewal = {
  caseId: string;
  caseNumber: string;
  ownerId: string;
  daysRemaining: number;
};

/** A greeting-eligible customer with their birth/founding date as Jalali parts. */
export type GreetingCandidate = {
  customerId: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  birth: { jy: number; jm: number; jd: number } | null;
};

/** A resolved birthday greeting ready to persist. */
export type GreetingIntent = {
  customerId: string;
  year: number;
  templateKey: string;
  smsRecipient: string;
  smsBody: string;
};

/** A QUEUED SMS awaiting a provider send (task 7). */
export type QueuedSms = { id: string; recipient: string; body: string };

/** A managerial/owner alert to create only if an identical-subject one is absent
 *  within the last 24h. */
export type AlertIntent = {
  userIds: string[];
  message: string;
  dedupePrefix: string;
};

// ---------------------------------------------------------------------------
// Stage-due reminders (تب تنظیمات مراحل)
// ---------------------------------------------------------------------------

/** A candidate open stage with a due date and a computed days-remaining. */
export type StageDueCandidate = {
  stageId: string;
  stageTitle: string;
  order: number;
  caseId: string;
  caseNumber: string;
  periodId: string;
  ownerId: string;
  daysRemaining: number;
  dueJalali: string | null;
  customer: {
    type: string;
    fullName: string | null;
    companyName: string | null;
    mobile: string;
  };
};

/** A fully-resolved stage-due reminder ready to persist. */
export type StageReminderIntent = {
  stageId: string;
  daysBefore: number;
  channels: string[]; // one or both of INTERNAL_NOTIFICATION / SMS_TO_CUSTOMER
  recipientUserIds: string[];
  notificationMessage: string;
  smsRecipient: string | null;
  smsBody: string | null;
};

/** The stage-due reminder settings the engine reads once per run. */
export type StageSettings = {
  enabled: boolean;
  daysBefore: number;
  channels: string[];
  recipients: string[];
  autoPrompt: boolean;
  notificationTemplate: string;
  smsTemplate: string;
};

/** Settings + rendered-template inputs the orchestrator needs, read once per run. */
export type EngineConfig = {
  instituteName: string;
  archiveDays: number;
  birthday: { enabled: boolean; sendHour: number };
  realSend: boolean;
  templates: Record<string, string>;
  stage: StageSettings;
};

/** The tallies of one run, written to EngineRunLog. */
export type EngineRunResult = {
  reminders: number;
  archived: number;
  abandoned: number;
  greetings: number;
  smsSent: number;
  errors: number;
  overdueAlerts: number;
  unfollowedAlerts: number;
  errorDetails: string[];
  campaignsProcessed: number;
  campaignsSent: number;
  stageReminders: number;
};

/**
 * The seam executeEngine drives.
 */
export interface EnginePorts {
  readonly config: EngineConfig;
  readonly managerIds: string[];

  // Task 1 — renewal reminders.
  listReminderCandidates(): Promise<ReminderCandidate[]>;
  dispatchReminder(intent: ReminderIntent): Promise<boolean>;

  // Task 1b — stage-due reminders.
  listStageDueCandidates(): Promise<StageDueCandidate[]>;
  dispatchStageReminder(intent: StageReminderIntent): Promise<boolean>;

  // Task 2 — overdue-task alerts to managers.
  listOverdueOwners(): Promise<OverdueOwner[]>;
  createAlertIfAbsent(intent: AlertIntent): Promise<number>;

  // Task 3 — uncontacted near-expiry renewals nudge the owner.
  listUnfollowedRenewals(): Promise<UnfollowedRenewal[]>;

  // Task 4 — archive long-closed tasks.
  archiveClosedTasksBefore(cutoff: Date): Promise<number>;

  // Task 5 — abandon expired, un-renewed periods.
  abandonExpiredPeriods(): Promise<number>;

  // Task 6 — birthday / founding-day greetings.
  listGreetingCandidates(): Promise<GreetingCandidate[]>;
  dispatchGreeting(intent: GreetingIntent): Promise<boolean>;

  // Task 6b — due campaigns.
  runCampaigns(now: Date): Promise<{
    campaignsProcessed: number;
    campaignsCompleted: number;
    sent: number;
    failed: number;
  }>;

  // Task 7 — process the SMS queue.
  listQueuedSms(): Promise<QueuedSms[]>;
  sendSms(msg: { recipient: string; body: string }): Promise<{ ok: boolean; error?: string }>;
  markSmsSent(id: string): Promise<void>;
  markSmsFailed(id: string, error: string): Promise<void>;

  // Persist the run's tallies.
  writeRunLog(result: EngineRunResult): Promise<void>;
}

// ---------------------------------------------------------------------------
// SMS log (C-14)
// ---------------------------------------------------------------------------

export type SmsLogRow = {
  id: string;
  recipient: string;
  body: string;
  templateKey: string;
  status: "QUEUED" | "SENT" | "FAILED";
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export type SmsLogView = {
  sent: number;
  queued: number;
  failed: number;
  rows: SmsLogRow[];
};