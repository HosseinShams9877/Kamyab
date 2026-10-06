// Public API of the periods module (the Period + CaseStage half of the
// Case -> Period -> CaseStage chain). Import periods functionality from
// "@/modules/periods" only (rule 8). Client components import the isomorphic
// leaves (./periods.types, ./periods.schema, ./periods.guards, ./lib/labels)
// directly, never this barrel (it pulls in server-only Prisma code).

// --- Service (server-only: Prisma, Jalali conversion, read-time computation) -
export {
  getPeriodsForCase,
  currentPeriod,
  stageProgress,
  createRegistrationPeriodTx,
  getStageForAction,
  getPeriodForStageAdd,
  applyStageActionTx,
  addExceptionalStageTx,
  deleteStageTx,
  moveStageTx,
  getPeriodCase,
  setPeriodTotalTx,
  getActivePeriod,
  getCurrentPeriod,
  setPeriodFollowUpTx,
  getRenewablePeriod,
  getPeriodLifecycle,
  renewPeriodTx,
  setPeriodStatusTx,
  getRenewalsView,
  getRenewalStats,
  getRenewalDashboard,
  listReminderCandidates,
  listUnfollowedRenewals,
  abandonExpiredPeriods,
  periodHasOpenStages,
  getStageForDueDate,
  setStageDueDateTx,
  listStageDueCandidates,
  createStageReminderLog,
} from "./periods.service";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  StageRow,
  PeriodRow,
  StageTemplate,
  RegistrationPeriodInput,
  StageActionOp,
  StageActionContext,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
  RenewPeriodInput,
  RenewablePeriod,
  PeriodLifecycle,
  RenewalRow,
  RenewalStats,
  RenewalListParams,
  PeriodCardFollowUp,
  RenewalMeta,
  EngineReminderRule,
  EngineReminderCandidate,
  EngineUnfollowedRenewal,
  StageDueCandidate,
} from "./periods.types";

// --- Schema (isomorphic) ----------------------------------------------------
export {
  renewalSchema,
  renewalFollowUpSchema,
  periodActionSchema,
} from "./periods.schema";
export type {
  RenewalInput,
  RenewalFollowUpInput,
  PeriodActionInput,
} from "./periods.schema";

// --- Guards (isomorphic: error, Persian messages, rules, tab classification) -
export {
  PeriodRuleError,
  isAbandonable,
  inRenewalTab,
  daysSinceExpiry,
  RENEWAL_TABS,
  NOTE_MAX,
  START_DATE_INVALID,
  DURATION_REQUIRED,
  DURATION_INVALID,
  NO_DURATION_DEFINED,
  AMOUNT_INVALID,
  AMOUNT_TOO_LARGE,
  NOTE_TOO_LONG,
  FOLLOW_UP_STATUS_REQUIRED,
  FOLLOW_UP_STATUS_INVALID,
  RENEWAL_FORBIDDEN,
  CASE_NOT_FOUND,
  CASE_CANCELLED,
  SERVICE_NOT_RENEWABLE,
  NO_ACTIVE_PERIOD,
  PERIOD_NOT_FOUND,
  NOT_ABANDONABLE,
  NOT_ABANDONED,
} from "./periods.guards";
export type { RenewalTab, RenewalFacts } from "./periods.guards";

// --- Module UI (re-exported for server consumers: the case + renewals pages) -
export { PeriodsPanel } from "./components/periods-panel";
export { RenewalsTable } from "./components/renewals-table";
export type { RenewalTableRow } from "./components/renewals-table";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  PERIOD_STATUS_LABELS,
  PERIOD_STATUS_BADGE,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_BADGE,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_BADGE,
  RENEWAL_TAB_LABELS,
  periodPathTitle,
} from "./lib/labels";