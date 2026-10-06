// Public API of the cases module. Import from "@/modules/cases" only (rule 8).

// --- Service (server-only) --------------------------------------------------
export {
  getCaseFormData,
  getServiceCaseMeta,
  registerCase,
  getCasePage,
  canEditStages,
  canAddStages,
  runStageAction,
  addExceptionalStage,
  deleteStage,
  moveStage,
  getCaseOwnership,
  runCaseMutation,
  listActiveCaseOptions,
  listCasesView,
  countActiveCases,
  countStaleCases,
  getActiveReceivables,
  getCaseStats,
  listServiceFilterOptions,
  listOwnerFilterOptions,
  canRegisterRenewal,
  canRecordRenewalFollowUp,
  canRestore,
  getRenewalMeta,
  registerRenewal,
  recordRenewalFollowUp,
  abandonPeriod,
  restorePeriod,
  canCancelCase,
  canRestoreCase,
  getCancellationDetail,
  cancelCase,
  restoreCase,
  getCancellationReport,
  canChangeOwner,
  getOwnerChangeMeta,
  changeCaseOwner,
  getStageSettings,
  saveStageSettings,
  setStageDueDate,
} from "./cases.service";
export type { CasePage, CaseMutationArgs } from "./cases.service";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  ServiceOption,
  OwnerOption,
  DurationOption,
  CaseFormData,
  ServiceCaseMeta,
  CaseHeader,
  CaseListItem,
  CaseStatusFilter,
  CaseListParams,
  CaseListResult,
  CaseStats,
  ServiceFilterOption,
  OwnerFilterOption,
  OwnerChangeMeta,
  ChangeOwnerResult,
  StageSettings,
  StageReminderChannel,
  StageReminderRecipient,
} from "./cases.types";

// --- Schema (isomorphic) ----------------------------------------------------
export {
  caseCreateSchema,
  stageActionSchema,
  addStageSchema,
  stageStructuralSchema,
  caseCancelSchema,
  caseRestoreSchema,
  caseChangeOwnerSchema,
  setStageDueDateSchema,
  stageSettingsSchema,
} from "./cases.schema";
export type {
  CaseCreateInput,
  StageActionInput,
  AddStageInput,
  StageStructuralInput,
  CaseCancelInput,
  CaseRestoreInput,
  CaseChangeOwnerInput,
  SetStageDueDateInput,
  StageSettingsInput,
} from "./cases.schema";

// --- Guards (isomorphic) ----------------------------------------------------
export * from "./cases.guards";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  CASE_STATUS_LABELS,
  CASE_STATUS_BADGE,
  stageCountHint,
} from "./lib/labels";

// --- Module UI --------------------------------------------------------------
export { CasesTable } from "./components/cases-table";
export { CaseForm } from "./components/case-form";
export { CaseTabs } from "./components/case-tabs";
export { CaseStages } from "./components/case-stages";
export { CaseCancelDialog } from "./components/case-cancel-dialog";
export { CaseRestoreButton } from "./components/case-restore-button";
export { CaseChangeOwnerDialog } from "./components/case-change-owner-dialog";
export { CancellationReportForm } from "./components/cancellation-report-form";
export { StageSettingsPanel } from "./components/stage-settings-panel";