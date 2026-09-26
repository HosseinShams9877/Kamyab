// Public API of the followups module (C-11 record-result + B-6). Other server code
// imports followups functionality from "@/modules/followups" only (rule 8). Client
// components are the exception: they import the isomorphic leaves (./followups.schema,
// ./followups.types, ./followups.guards, ./lib) directly, never this barrel.

// --- Service (server-only: the record-result transaction, cross-module seams) -
export {
  listActiveResults,
  listCaseFollowUps,
  listLatestFollowUpByPeriod,
  recordResult,
} from "./followups.service";
export type { FollowUpActionResult } from "./followups.service";

// --- Schema (isomorphic) ----------------------------------------------------
export { recordResultSchema } from "./followups.schema";
export type { RecordResultInput } from "./followups.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type { FollowUpResultOption, FollowUpRow, LatestPeriodFollowUp } from "./followups.types";

// --- Guards (isomorphic: error + Persian messages + effect→period mapping) --
export { FollowUpRuleError, periodEffect } from "./followups.guards";

// --- Presentation labels (isomorphic) ---------------------------------------
export { RENEWAL_EFFECT_LABELS } from "./lib/labels";

// --- Module UI (re-exported for server consumers: the case page timeline slot) -
export { FollowUpTimeline } from "./components/follow-up-timeline";
