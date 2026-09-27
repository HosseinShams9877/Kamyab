// Isomorphic types for global search (C-16). Shared by the service, the
// /api/search route, and the client search box — no Prisma, no server-only code.

/** A customer match. `displayName` is already formatted; `active` drives the
 *  status badge (a deactivated customer is still findable). */
export type SearchCustomerHit = {
  id: string;
  code: string;
  displayName: string;
  mobile: string;
  active: boolean;
};

/** A case match. `status` is the raw CaseStatus and `statusLabel` its Persian
 *  label — a cancelled case is still findable and shows its badge. */
export type SearchCaseHit = {
  id: string;
  number: string;
  customerName: string;
  serviceName: string;
  status: string;
  statusLabel: string;
};

/** Categorized results (C-16): customers and cases. Empty arrays render the
 *  "موردی یافت نشد" state in the client box. */
export type SearchResults = {
  customers: SearchCustomerHit[];
  cases: SearchCaseHit[];
};

/** Search is only run once the term is meaningful, to avoid matching everything. */
export const SEARCH_MIN_LENGTH = 2;
