// Public API of the periods module (the Period + CaseStage half of the
// Case -> Period -> CaseStage chain). Import periods functionality from
// "@/modules/periods" only (rule 8). Client components import the isomorphic
// leaves (./periods.types, ./lib/labels) directly, never this barrel (it pulls
// in server-only Prisma code).
//
// Phase 9 scope: create a case's first period + copied stages (the seam the
// cases module calls in its save transaction) and read periods for the case
// page shell. A periods.schema / periods.guards / period components arrive with
// renewal (a later phase) when period-level input and rules first exist —
// adding them now would be dead code.

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
} from "./periods.types";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  PERIOD_STATUS_LABELS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_BADGE,
  FOLLOW_UP_STATUS_LABELS,
  periodPathTitle,
} from "./lib/labels";
