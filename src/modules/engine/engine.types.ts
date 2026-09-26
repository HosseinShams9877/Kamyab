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
  daysRemaining: number | null; // computed upstream from the stored expiry (rule 2)
  expiryJalali: string | null; // ASCII "YYYY/MM/DD" for the SMS body
  serviceName: string;
  customer: {
    type: string; // NATURAL | LEGAL
    fullName: string | null;
    companyName: string | null;
    mobile: string;
  };
  rules: ReminderRuleView[];
};

/** A fully-resolved reminder ready to persist: recipients + text already decided,
 *  so the repository only writes rows and never composes Persian. */
export type ReminderIntent = {
  periodId: string;
  ruleId: string;
  channel: string;
  userIds: string[]; // INTERNAL_NOTIFICATION targets (empty for SMS)
  notificationMessage: string;
  smsRecipient: string | null; // SMS_TO_CUSTOMER only
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
  type: string; // NATURAL | LEGAL
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  birth: { jy: number; jm: number; jd: number } | null; // null = no dated info
};

/** A resolved birthday greeting ready to persist (BirthdayLog + queued SMS). */
export type GreetingIntent = {
  customerId: string;
  year: number; // Jalali year — the BirthdayLog unique key (once per year)
  templateKey: string; // birthday_natural | birthday_legal
  smsRecipient: string;
  smsBody: string;
};

/** A QUEUED SMS awaiting a provider send (task 7). */
export type QueuedSms = { id: string; recipient: string; body: string };

/** A managerial/owner alert to create only if an identical-subject one is absent
 *  within the last 24h (the anti-repeat window keys on `dedupePrefix`). */
export type AlertIntent = {
  userIds: string[];
  message: string;
  dedupePrefix: string; // stable per-subject text (never varies with the count)
};

/** Settings + rendered-template inputs the orchestrator needs, read once per run. */
export type EngineConfig = {
  instituteName: string;
  archiveDays: number; // tasks closed more than this many days ago are archived
  birthday: { enabled: boolean; sendHour: number };
  realSend: boolean; // when false, SMS is queued + recorded but never sent
  templates: Record<string, string>; // eventKey -> body
};

/** The tallies of one run, written to EngineRunLog. `overdueAlerts` /
 *  `unfollowedAlerts` / `errorDetails` land in the log's `detail` JSON (the table
 *  has no column for them) so the /engine page can still surface them. */
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
};

/**
 * The seam executeEngine drives. Every side-effect is a method here; the pure
 * orchestrator only decides. `dispatchReminder` / `dispatchGreeting` return false
 * when the unique index already has the row (a made-up or re-run dispatch), which
 * is exactly how "once per period" / "once per year" is guaranteed — never by a
 * re-check in the orchestrator.
 */
export interface EnginePorts {
  readonly config: EngineConfig;
  readonly managerIds: string[];

  // Task 1 — renewal reminders.
  listReminderCandidates(): Promise<ReminderCandidate[]>;
  dispatchReminder(intent: ReminderIntent): Promise<boolean>; // false = already sent

  // Task 2 — overdue-task alerts to managers (24h anti-repeat).
  listOverdueOwners(): Promise<OverdueOwner[]>;
  createAlertIfAbsent(intent: AlertIntent): Promise<number>; // # notifications created

  // Task 3 — uncontacted near-expiry renewals nudge the owner (24h anti-repeat).
  listUnfollowedRenewals(): Promise<UnfollowedRenewal[]>;

  // Task 4 — archive long-closed tasks.
  archiveClosedTasksBefore(cutoff: Date): Promise<number>;

  // Task 5 — abandon expired, un-renewed periods.
  abandonExpiredPeriods(): Promise<number>;

  // Task 6 — birthday / founding-day greetings (once per year).
  listGreetingCandidates(): Promise<GreetingCandidate[]>;
  dispatchGreeting(intent: GreetingIntent): Promise<boolean>; // false = already greeted

  // Task 7 — process the SMS queue (only when real sending is on).
  listQueuedSms(): Promise<QueuedSms[]>;
  sendSms(msg: { recipient: string; body: string }): Promise<{ ok: boolean; error?: string }>;
  markSmsSent(id: string): Promise<void>;
  markSmsFailed(id: string, error: string): Promise<void>;

  // Persist the run's tallies.
  writeRunLog(result: EngineRunResult): Promise<void>;
}
