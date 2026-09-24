// Dev-only helper: run Prisma commands against SQLite without touching the
// canonical PostgreSQL schema.
//
// It reads prisma/schema.prisma, swaps the datasource provider from
// "postgresql" to "sqlite", writes prisma/schema.dev.prisma (gitignored), then
// runs the requested Prisma command with --schema pointed at that dev file.
//
// Usage:
//   node scripts/prisma-dev.mjs push     -> prisma db push   (create/sync dev.db)
//   node scripts/prisma-dev.mjs studio   -> prisma studio    (browse dev.db)
//   node scripts/prisma-dev.mjs generate -> prisma generate  (dev client)
//
// This never installs or connects to a server; SQLite is just a local file.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(__dirname, "..", "prisma");
const canonical = join(prismaDir, "schema.prisma");
const devSchema = join(prismaDir, "schema.dev.prisma");

const command = process.argv[2];
const allowed = { push: "db push", studio: "studio", generate: "generate" };
if (!command || !allowed[command]) {
  console.error(
    `Unknown command "${command ?? ""}". Use one of: ${Object.keys(allowed).join(", ")}`,
  );
  process.exit(1);
}

// Swap the provider. The match is intentionally strict so an unexpected schema
// shape fails loudly rather than silently producing a wrong dev schema.
const source = readFileSync(canonical, "utf8");
const swapped = source.replace(
  /provider\s*=\s*"postgresql"/,
  'provider = "sqlite"',
);
if (swapped === source) {
  console.error(
    'Could not find `provider = "postgresql"` in prisma/schema.prisma. Aborting.',
  );
  process.exit(1);
}
writeFileSync(devSchema, swapped, "utf8");

const prismaArgs = allowed[command];
const full = `npx prisma ${prismaArgs} --schema "${devSchema}"`;
console.log(`> ${full}`);
execSync(full, { stdio: "inherit", env: process.env });
