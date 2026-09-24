// Public API of the settings module. Import settings access from
// "@/modules/settings" only.
export { getSetting, getInstituteName } from "./settings.service";

export { instituteNameSchema } from "./settings.schema";
export type { InstituteName } from "./settings.schema";
export type { SettingRow, SettingKey } from "./settings.types";
