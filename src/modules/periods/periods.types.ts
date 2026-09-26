import type { PeriodStatus, StageStatus, FollowUpStatus } from "@/types/enums";

// Domain types for the periods module (the Period + CaseStage half of the
// Case -> Period -> CaseStage chain). Isomorphic leaf: pure types, safe to
// import from client components. Dates are surfaced as Jalali "YYYY/MM/DD"
// strings (ASCII digits) so no consumer deals with Gregorian Date objects.

/** One copied path stage bound to a period. A read-only view for Phase 9 (the
 *  six stage actions arrive with the stage engine, C-6 / Phase 10). */
export type StageRow = {
  id: string;
  title: string;
  order: number;
  status: StageStatus;
  isExceptional: boolean;
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
