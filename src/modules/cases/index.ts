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
  runStageAction,
  addExceptionalStage,
  deleteStage,
  moveStage,
  canEditStages,
  canAddStages,
  getCaseOwnership,
  runCaseMutation,
  listActiveCaseOptions,
  getRenewalMeta,
  registerRenewal,
  recordRenewalFollowUp,
  abandonPeriod,
  restorePeriod,
  canRegisterRenewal,
  canRecordRenewalFollowUp,
  canRestore,
  canCancelCase,
  canRestoreCase,
  getCancellationDetail,
  cancelCase,
  restoreCase,
  getCancellationReport,
  listCasesView,
  countActiveCases,
  countStaleCases,
  getActiveReceivables,
  getCaseStats,
  listServiceFilterOptions,
  listOwnerFilterOptions,
  canChangeOwner,
  getOwnerChangeMeta,
  changeCaseOwner,
} from "./cases.service";
export type { CasePage, CaseMutationArgs } from "./cases.service";

// --- Schema (isomorphic) ----------------------------------------------------
export {
  caseCreateSchema,
  stageActionSchema,
  addStageSchema,
  stageStructuralSchema,
  caseCancelSchema,
  caseRestoreSchema,
  caseChangeOwnerSchema,
} from "./cases.schema";
export type {
  CaseCreateInput,
  StageActionInput,
  AddStageInput,
  StageStructuralInput,
  CaseCancelInput,
  CaseRestoreInput,
  CaseChangeOwnerInput,
} from "./cases.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  ServiceOption,
  OwnerOption,
  DurationOption,
  CaseFormData,
  ServiceCaseMeta,
  CaseHeader,
  CaseListItem,
  CaseListParams,
  CaseListResult,
  CaseStatusFilter,
  CaseStats,
  ServiceFilterOption,
  OwnerFilterOption,
  OwnerChangeMeta,
  ChangeOwnerResult,
} from "./cases.types";

// --- Guards (isomorphic: error + Persian messages + read-time helpers) ------
export { CaseRuleError, daysRemainingUntil, aggregateCancellations } from "./cases.guards";
export type { CancellationReport, CancellationReasonCount, CancellationRow } from "./cases.guards";

// --- Module UI (re-exported for server consumers: the case pages) -----------
export { CaseForm } from "./components/case-form";
export { CaseTabs } from "./components/case-tabs";
export { CaseCancelDialog } from "./components/case-cancel-dialog";
export { CaseRestoreButton } from "./components/case-restore-button";
export { CaseChangeOwnerDialog } from "./components/case-change-owner-dialog";
export { CasesTable } from "./components/cases-table";
export { CancellationReportForm } from "./components/cancellation-report-form";
// --- Presentation labels (isomorphic) ---------------------------------------
export { CASE_STATUS_LABELS, CASE_STATUS_BADGE, stageCountHint } from "./lib/labels";