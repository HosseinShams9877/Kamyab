// Public API of the cases module (C-4 case registration, C-5 case page shell).
// Other server code imports cases functionality from "@/modules/cases" only
// (rule 8). Client components are the exception: they import the isomorphic
// leaves (./cases.schema, ./cases.types) and the module's own lib/ directly,
// never this barrel (it pulls in server-only Prisma code).

// --- Service (server-only: Prisma, transactions, cross-module seams) ---------
export {
  getCaseFormData,
  getServiceCaseMeta,
  registerCase,
  getCasePage,
} from "./cases.service";
export type { CasePage } from "./cases.service";

// --- Schema (isomorphic) ----------------------------------------------------
export { caseCreateSchema } from "./cases.schema";
export type { CaseCreateInput } from "./cases.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  ServiceOption,
  OwnerOption,
  DurationOption,
  CaseFormData,
  ServiceCaseMeta,
  CaseHeader,
} from "./cases.types";

// --- Guards (isomorphic: error + Persian messages + read-time helpers) ------
export { CaseRuleError, daysRemainingUntil } from "./cases.guards";

// --- Module UI (re-exported for server consumers: the case pages) -----------
export { CaseForm } from "./components/case-form";
export { CaseTabs } from "./components/case-tabs";

// --- Presentation labels (isomorphic) ---------------------------------------
export { CASE_STATUS_LABELS, CASE_STATUS_BADGE, stageCountHint } from "./lib/labels";
