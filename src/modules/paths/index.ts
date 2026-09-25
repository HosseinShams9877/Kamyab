// Public API of the paths module (B-2 ordered path stages, B-3 validity
// durations). Import paths functionality from "@/modules/paths" only (rule 8).
// Client components are the one exception: they import the isomorphic leaves
// (./paths.schema, ./paths.types) and the module's own lib/ directly, never this
// barrel (it pulls in server-only Prisma code).

// --- Service (server-only: transactions, Prisma, Persian messages) ----------
export {
  getServicePaths,
  addStage,
  renameStage,
  moveStage,
  removeStage,
  listDurations,
  addDuration,
  updateDuration,
  deleteDuration,
  setDurationActive,
  clearServiceDefinition,
  PathRuleError,
} from "./paths.service";

// --- Schemas (isomorphic) ---------------------------------------------------
export {
  stageCreateSchema,
  stageUpdateSchema,
  stageMoveSchema,
  durationCreateSchema,
  durationUpdateSchema,
  durationSetActiveSchema,
} from "./paths.schema";
export type {
  StageCreateInput,
  StageUpdateInput,
  StageMoveInput,
  DurationCreateInput,
  DurationUpdateInput,
  DurationSetActiveInput,
} from "./paths.schema";

// --- Types ------------------------------------------------------------------
export type {
  PathType,
  PathStageRow,
  ServicePaths,
  DurationRow,
} from "./paths.types";

// --- Module UI (re-exported for server consumers: pages) --------------------
export { PathEditor } from "./components/path-editor";
export { DurationsEditor } from "./components/durations-editor";

// --- Presentation labels (isomorphic) ---------------------------------------
export { PATH_TYPE_LABELS } from "./lib/labels";
