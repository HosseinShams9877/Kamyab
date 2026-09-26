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
