// Public API of the settings module. Import settings access from
// "@/modules/settings" only (rule 8). Client components are the one exception:
// they import the isomorphic leaves (./settings.schema, ./settings.types) and
// the module's own lib/ directly, never this barrel.

// --- Service (server-only: transactions, Prisma, Persian messages) ----------
export {
  getSetting,
  getInstituteName,
  getInstituteInfo,
  saveInstituteInfo,
  getThresholds,
  saveThresholds,
  getBirthday,
  saveBirthday,
  getGateway,
  saveGateway,
  testGateway,
  listTemplates,
  updateTemplate,
  getSmsStatus,
  listListItems,
  createListItem,
  updateListItem,
  moveListItem,
  deleteListItem,
  SettingsRuleError,
} from "./settings.service";

// --- Schemas (isomorphic) ---------------------------------------------------
export {
  instituteNameSchema,
  instituteInfoSchema,
  thresholdsSchema,
  birthdaySchema,
  smsGatewaySchema,
  smsTemplateSchema,
  listCreateSchema,
  listUpdateSchema,
  listMoveSchema,
  listTitleSchema,
  SMS_PROVIDER_VALUES,
} from "./settings.schema";
export type {
  InstituteName,
  InstituteInfoInput,
  ThresholdsInput,
  BirthdayInput,
  SmsGatewayInput,
  SmsTemplateInput,
  ListCreateInput,
  ListUpdateInput,
  ListMoveInput,
} from "./settings.schema";

// --- Types ------------------------------------------------------------------
export type {
  SettingRow,
  SettingKey,
  ListKind,
  ListItem,
  InstituteInfo,
  Thresholds,
  BirthdaySettings,
  GatewayView,
  SmsTemplateRow,
  SmsFailure,
  SmsStatusView,
} from "./settings.types";
export { LIST_KINDS } from "./settings.types";

// --- Module UI (re-exported for server consumers: pages/layouts) ------------
export { ListSection } from "./components/list-section";
export { InstituteInfoForm } from "./components/institute-info-form";
export { ThresholdsForm } from "./components/thresholds-form";
export { BirthdayForm } from "./components/birthday-form";
export { SmsTemplatesForm } from "./components/sms-templates-form";
export { SmsGatewayForm } from "./components/sms-gateway-form";
export { SmsStatusPanel } from "./components/sms-status-panel";
