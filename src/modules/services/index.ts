// Public API of the services module (B-1 service definition, B-4 reminder rules).
// Import services functionality from "@/modules/services" only (rule 8). Client
// components are the one exception: they import the isomorphic leaves
// (./services.schema, ./services.types) and the module's own lib/ directly,
// never this barrel (it pulls in server-only Prisma code).

// --- Service (server-only: transactions, Prisma, Persian messages) ----------
export {
  listServices,
  getService,
  listActiveServiceOptions,
  listCategoryOptions,
  createService,
  updateService,
  setServiceStatus,
  deleteService,
  getServiceStats,
  listReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  ServiceRuleError,
} from "./services.service";

// --- Schemas (isomorphic) ---------------------------------------------------
export {
  serviceCreateSchema,
  serviceUpdateSchema,
  serviceStatusSchema,
  reminderRuleCreateSchema,
  reminderRuleUpdateSchema,
} from "./services.schema";
export type {
  ServiceCreateInput,
  ServiceUpdateInput,
  ServiceStatusInput,
  ReminderRuleCreateInput,
  ReminderRuleUpdateInput,
} from "./services.schema";

// --- Types ------------------------------------------------------------------
export type {
  CategoryOption,
  ServiceListItem,
  ServiceDetail,
  ServiceStats,
  ReminderRuleRow,
} from "./services.types";

// --- Module UI (re-exported for server consumers: pages) --------------------
export { ServiceForm } from "./components/service-form";
export { ServiceRowActions } from "./components/service-row-actions";
export { ReminderRulesEditor } from "./components/reminder-rules-editor";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  REMINDER_CHANNEL_LABELS,
  REMINDER_RECIPIENT_LABELS,
  daysBeforeLabel,
} from "./lib/labels";