import type { CustomerType } from "@/types/enums";

// TypeScript types for the customers domain (C-3). Persian labels are a
// presentation concern and live in the components / lib, not here.

// A row in the customer list. `activeCases` is COMPUTED at read time (rule 2 —
// never stored): the count of the customer's cases whose status is New or
// In Progress.
export type CustomerListItem = {
  id: string;
  code: string;
  displayName: string;
  type: CustomerType;
  mobile: string;
  city: string | null;
  activeCases: number;
  status: boolean;
  // Names of the services on this customer's ACTIVE cases (badge display).
  activeServiceNames: string[];
  // The owner of the customer's most recent case, if any.
  ownerName: string | null;
  // The date of the customer's most recent follow-up (Jalali "YYYY/MM/DD"), if any.
  lastFollowUpAt: string | null;
};

// The four headline numbers on top of the customer list (C-3).
export type CustomerStats = {
  total: number;
  active: number;
  nearRenewal: number; // customers with an active period expiring within 30 days
  inactive: number;
};

// A pick-list entry for the "service" filter dropdown.
export type ServiceFilterOption = {
  id: string;
  name: string;
};

// A pick-list entry for the "employee" filter dropdown.
export type EmployeeFilterOption = {
  id: string;
  fullName: string;
};

// The full record used to prefill the edit form and render the top card.
export type CustomerDetail = {
  id: string;
  code: string;
  type: CustomerType;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  nationalId: string | null;
  nationalEntityId: string | null;
  registrationNumber: string | null;
  // Dates are surfaced as Jalali "YYYY/MM/DD" strings (ASCII digits) so the form
  // and card never deal with Gregorian Date objects.
  birthDate: string | null;
  foundingDate: string | null;
  sendGreeting: boolean;
  landline: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: boolean;
};

// A case shown on the customer page. status is stored; everything financial and
// path-related is computed at read time from the case's periods and stages.
export type CustomerCaseSummary = {
  id: string;
  number: string;
  serviceName: string;
  status: string; // CaseStatus
  currentStageTitle: string | null;
  stagesDone: number;
  stagesTotal: number;
  // Financial balance = sum(period totals) - sum(payments). null when no period
  // has a total set (the UI shows "—", never zero).
  balance: number | null;
};

// One entry in the customer's follow-up timeline (across all their cases).
export type FollowUpEntry = {
  id: string;
  caseNumber: string;
  resultTitle: string;
  note: string | null;
  authorName: string;
  createdAt: Date;
};

// Everything the customer page needs beyond the top card.
export type CustomerPageData = {
  cases: CustomerCaseSummary[];
  totalBalance: number | null;
  caseCount: number;
  followUps: FollowUpEntry[];
};

// A pick-list entry for the case-registration form (C-4). `hasBirthInfo` is
// true when the customer already has the birth/founding date their type needs,
// so the form knows whether to reveal the birth-date field.
export type CustomerOption = {
  id: string;
  displayName: string;
  type: CustomerType;
  mobile: string;
  hasBirthInfo: boolean;
  sendGreeting: boolean;
};

// List query + result. The sort keys map to server-side orderings.
export type CustomerSort = "newest" | "name" | "cases";

export type CustomerListParams = {
  q?: string;
  type?: CustomerType | "";
  status?: "active" | "inactive" | "";
  city?: string;
  serviceId?: string;
  sort?: CustomerSort;
  /** Restrict to customers related to this employee's active cases (C-15). */
  ownerId?: string;
  page?: number;
};

export type CustomerListResult = {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};