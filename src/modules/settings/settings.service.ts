import { findSetting } from "./settings.repository";
import { instituteNameSchema } from "./settings.schema";
import type { SettingKey } from "./settings.types";

// Settings service. Settings are stored as key → JSON-serialized string (the
// value column is a String for SQLite/PostgreSQL parity), so reads parse the
// JSON back. Rule 1 (nothing hardcoded): user-facing values like the institute
// name come from here, never from a string literal in a component.

/** Read a single setting, parsed from its JSON value. Returns null if absent. */
export async function getSetting<T = unknown>(key: SettingKey): Promise<T | null> {
  const row = await findSetting(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    // A value that isn't valid JSON is returned as the raw string.
    return row.value as unknown as T;
  }
}

/** Institute name for headings and the login page (seeded default exists). */
export async function getInstituteName(): Promise<string> {
  const name = await getSetting<string>("institute_name");
  // Non-empty text passes the schema; anything else falls back to the default.
  return instituteNameSchema.safeParse(name).success ? (name as string) : "موسسه حقوقی ثبت کامیاب";
}
