import type { CaseStatus } from "@/types/enums";
import type { CustomerOption } from "@/modules/customers/customers.types";

// Domain types for the cases module (C-4 registration, C-5 page shell).
// Isomorphic leaf: pure types, safe to import from the client case form.
// Dates are Jalali "YYYY/MM/DD" strings so no consumer touches Gregorian dates.

export type ServiceOption = { id: string; name: string; renewable: boolean };
export type OwnerOption = { id: string; fullName: string };
export type DurationOption = {
  id: string;
  title: string;
  monthCount: number;
  isDefault: boolean;
};

/** Everything the case-registration form (C-4) needs to render its pick lists. */
export type CaseFormData = {
  customers: CustomerOption[];
  services: ServiceOption[];
  owners: OwnerOption[];
  presetCustomerId: string | null;
};

/** Loaded when a service is picked: drives the duration list, the stage-count
 *  hint, and whether the duration/expiry section is shown (C-4 live behavior). */
export type ServiceCaseMeta = {
  serviceId: string;
  renewable: boolean;
  stageCount: number;
  durations: DurationOption[];
};

/** The case-page header (C-5). daysRemaining/progress are computed at read time
 *  (rule 2), never stored. */
export type CaseHeader = {
  id: string;
  number: string;
  status: CaseStatus;
  customerId: string;
  customerName: string;
  serviceName: string;
  ownerId: string;
  ownerName: string;
  startDate: string | null;
  expiryDate: string | null;
  daysRemaining: number | null;
  progressPassed: number;
  progressTotal: number;
};

// --- Case list (C-2 dashboard links / C-15 employee "my cases" / Phase 16) --

/** A row in the cases list. `balance` is null when no period has a total.
 *  `currentStageTitle` is the first open stage of the case's active period
 *  (null when all stages are closed or the case has no path). */
export type CaseListItem = {
  id: string;
  number: string;
  customerName: string;
  serviceName: string;
  ownerName: string;
  status: CaseStatus;
  balance: number | null;
  currentStageTitle: string | null;
  /** Jalali "YYYY/MM/DD" (ASCII digits — the page applies Persian digits). */
  lastActivity: string;
};

/** The status filter values the list accepts. "active" = NEW | IN_PROGRESS. */
export type CaseStatusFilter =
  | ""
  | "active"
  | "NEW"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CaseListParams = {
  q?: string;
  status?: CaseStatusFilter;
  serviceId?: string;
  ownerId?: string;
  /** Only cases with a positive outstanding balance (a computed filter). */
  hasBalance?: boolean;
  /** Only active cases with no activity past the stale threshold. */
  stale?: boolean;
  page?: number;
};

export type CaseListResult = {
  items: CaseListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** The four headline numbers above the case list (C-2 style). */
export type CaseStats = {
  total: number;
  active: number;
  waitingAction: number; // active cases with at least one open stage
  completedThisMonth: number; // cases completed in the current Jalali month
};

/** A service pick-list entry for the list's service filter. */
export type ServiceFilterOption = { id: string; name: string };

/** An employee pick-list entry for the list's owner filter. */
export type OwnerFilterOption = { id: string; fullName: string };

// --- Change owner (C-5 header action) --------------------------------------

/** Meta the owner-change dialog needs: the current owner plus the list of
 *  active employees the case can be reassigned to (the current owner excluded). */
export type OwnerChangeMeta = {
  currentOwnerId: string;
  candidates: OwnerOption[];
  /** Number of OPEN tasks attached to the case (for the dialog's hint). */
  openTasks: number;
};

/** The outcome of a change-owner attempt. `movedTasks` is present only when the
 *  operation succeeded (the count of tasks reassigned along with the case). */
export type ChangeOwnerResult =
  | { ok: true; movedTasks: number }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };