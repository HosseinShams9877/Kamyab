import type { PeriodStatus, StageStatus, FollowUpStatus } from "@/types/enums";

// Domain types for the periods module (the Period + CaseStage half of the
// Case -> Period -> CaseStage chain). Isomorphic leaf: pure types, safe to
// import from client components. Dates are surfaced as Jalali "YYYY/MM/DD"
// strings (ASCII digits) so no consumer deals with Gregorian Date objects.

/** One copied path stage bound to a period (C-6). Date columns are surfaced as
 *  Jalali "YYYY/MM/DD" strings; every figure is read as stored (the stage
 *  engine writes them, the case page renders them). */
export type StageRow = {
  id: string;
  title: string;
  order: number;
  status: StageStatus;
  isExceptional: boolean;
  startDate: string | null; // Jalali; set on Start
  endDate: string | null; // Jalali; set on Done/Not-Needed, cleared on Reopen
  attemptCount: number; // +1 on each Reject
  note: string | null;
  lastChangedByName: string | null; // who last touched the stage
};

/** A validity span of a case. indexNumber 1 = registration, 2+ = renewals. */
export type PeriodRow = {
  id: string;
  indexNumber: number;
  status: PeriodStatus;
  startDate: string; // Jalali YYYY/MM/DD
  expiryDate: string | null; // Jalali YYYY/MM/DD; null when non-renewable
  totalAmount: number | null; // integer Toman; null -> balance shows "—"
  followUpStatus: FollowUpStatus;
  stages: StageRow[];
  // Financial figures are computed at read time (rule 2), never stored.
  paid: number;
  balance: number | null; // totalAmount - paid; null when totalAmount is null
};

/** A stage template to copy into a new period (from the service's INITIAL path). */
export type StageTemplate = {
  title: string;
  order: number;
};

/** The data needed to create a case's first period inside the save transaction. */
export type RegistrationPeriodInput = {
  caseId: string;
  startDate: Date;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  stages: StageTemplate[];
};

// --- Stage engine (C-6 / Phase 10) ------------------------------------------

/** The five status transitions plus the always-available note edit (C-6). */
export type StageActionOp =
  | "start"
  | "done"
  | "reject"
  | "not_needed"
  | "reopen"
  | "note";

/** Read context for a stage action: the owning case + the stage's current state,
 *  drawn only from periods-owned columns (Period.caseId, CaseStage). The cases
 *  service reads the Case itself for ownership/status (rule 9). */
export type StageActionContext = {
  caseId: string;
  periodId: string;
  status: StageStatus;
  title: string;
  isExceptional: boolean;
  attemptCount: number;
};

/** Apply one status transition (+ auto-advance for done/not-needed) on the
 *  caller's transaction (rule 4). */
export type ApplyStageActionArgs = {
  stageId: string;
  op: StageActionOp;
  note: string | null;
  actorId: string;
};

/** Append an exceptional stage to a period (goes to the end of the path). */
export type AddExceptionalStageArgs = {
  periodId: string;
  title: string;
  actorId: string;
};

/** Move a stage one position toward the start ("up") or end ("down"). */
export type MoveStageArgs = {
  stageId: string;
  direction: "up" | "down";
};
