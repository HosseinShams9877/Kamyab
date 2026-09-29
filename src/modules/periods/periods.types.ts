import type { PeriodStatus, StageStatus, FollowUpStatus } from "@/types/enums";

// Domain types for the periods module (the Period + CaseStage half of the
// Case -> Period -> CaseStage chain). Isomorphic leaf: pure types, safe to
// import from client components. Dates are surfaced as Jalali "YYYY/MM/DD"
// strings (ASCII digits) so no consumer deals with Gregorian Date objects.

/** One copied path stage bound to a period (C-6). */
export type StageRow = {
  id: string;
  title: string;
  order: number;
  status: StageStatus;
  isExceptional: boolean;
  startDate: string | null;
  endDate: string | null;
  attemptCount: number;
  note: string | null;
  lastChangedByName: string | null;
};

/** A validity span of a case. indexNumber 1 = registration, 2+ = renewals. */
export type PeriodRow = {
  id: string;
  indexNumber: number;
  status: PeriodStatus;
  startDate: string;
  expiryDate: string | null;
  totalAmount: number | null;
  followUpStatus: FollowUpStatus;
  stages: StageRow[];
  paid: number;
  balance: number | null;
};

export type StageTemplate = {
  title: string;
  order: number;
};

export type RegistrationPeriodInput = {
  caseId: string;
  startDate: Date;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  stages: StageTemplate[];
};

// --- Stage engine (C-6 / Phase 10) ------------------------------------------

export type StageActionOp =
  | "start"
  | "done"
  | "reject"
  | "not_needed"
  | "reopen"
  | "note";

export type StageActionContext = {
  caseId: string;
  periodId: string;
  status: StageStatus;
  title: string;
  isExceptional: boolean;
  attemptCount: number;
};

export type ApplyStageActionArgs = {
  stageId: string;
  op: StageActionOp;
  note: string | null;
  actorId: string;
};

export type AddExceptionalStageArgs = {
  periodId: string;
  title: string;
  actorId: string;
};

export type MoveStageArgs = {
  stageId: string;
  direction: "up" | "down";
};

// --- Renewal (C-9) + renewals page (C-10) -----------------------------------

export type RenewPeriodInput = {
  previousPeriodId: string;
  caseId: string;
  indexNumber: number;
  startDate: Date;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  stages: StageTemplate[];
};

export type RenewablePeriod = {
  id: string;
  indexNumber: number;
  expiryDate: string | null;
  followUpStatus: FollowUpStatus;
};

export type PeriodLifecycle = {
  caseId: string;
  status: PeriodStatus;
  followUpStatus: FollowUpStatus;
  daysRemaining: number | null;
  indexNumber: number;
};

/** One row of the renewals work-queue (C-10). */
export type RenewalRow = {
  periodId: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  ownerName: string;
  ownerId: string;
  indexNumber: number;
  expiryDate: string | null;
  daysRemaining: number | null;
  followUpStatus: FollowUpStatus;
  status: PeriodStatus;
  totalAmount: number | null;
  balance: number | null;
  abandonable: boolean;
};

/** The four headline stats above the renewals table (C-10). */
export type RenewalStats = {
  expired: number;
  within7: number;
 
};

/** Filter params the renewals page accepts (all optional). */
export type RenewalListParams = {
  q?: string;
  serviceId?: string;
  ownerId?: string;
  followUpStatus?: FollowUpStatus | "";
};

export type PeriodCardFollowUp = {
  name: string;
  date: string;
  note: string | null;
};

export type RenewalMeta = {
  renewable: boolean;
  durations: { id: string; title: string; monthCount: number; isDefault: boolean }[];
  defaultStartDate: string | null;
};

// --- Engine seams (C-14 / Phase 15) -----------------------------------------

export type EngineReminderRule = {
  id: string;
  daysBefore: number;
  channel: string;
  recipient: string;
};

export type EngineReminderCandidate = {
  periodId: string;
  caseNumber: string;
  ownerId: string;
  daysRemaining: number | null;
  expiryJalali: string | null;
  serviceName: string;
  customer: { type: string; fullName: string | null; companyName: string | null; mobile: string };
  rules: EngineReminderRule[];
};

export type EngineUnfollowedRenewal = {
  caseId: string;
  caseNumber: string;
  ownerId: string;
  daysRemaining: number;
};