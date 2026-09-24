// Types for the settings domain. The Setting store is a key → JSON-serialized
// string map (a String column, for SQLite/PostgreSQL parity), so these describe
// the shapes the repository reads and the service returns.

/** A single raw Setting row as stored (value is a JSON-serialized string). */
export type SettingRow = {
  key: string;
  value: string;
};

/**
 * Well-known setting keys used across the app. Extended as settings-backed
 * features land; keeping them in one union keeps reads/writes honest.
 */
export type SettingKey = "institute_name";
