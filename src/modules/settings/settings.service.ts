import { findSetting } from "./settings.repository";

// Settings service. Settings are stored as key → JSON-serialized string (the
// value column is a String for SQLite/PostgreSQL parity), so reads parse the
// JSON back. Rule 1 (nothing hardcoded): user-facing values like the institute
// name come from here, never from a string literal in a component.

/** Read a single setting, parsed from its JSON value. Returns null if absent. */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
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
  return name && name.trim().length > 0 ? name : "موسسه حقوقی ثبت کامیاب";
}
