import { prisma } from "@/lib/db";

// Data access for the settings domain. The key-value Setting store holds
// JSON-serialized strings (String column for SQLite/PostgreSQL parity); parsing
// is the service's concern.

/** Read a single raw Setting row by key, or null when absent. */
export function findSetting(key: string) {
  return prisma.setting.findUnique({ where: { key } });
}
