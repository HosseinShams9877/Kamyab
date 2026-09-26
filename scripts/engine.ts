// Trigger #2 for the automatic engine (C-14): a one-shot CLI run, for a manual
// invocation or a scheduler that prefers a command over an HTTP call. It shares
// the SAME runner as POST /api/engine/run — there is one engine, two triggers —
// so behavior is identical. Run with:  npm run engine   (=> tsx scripts/engine.ts)
//
// process.loadEnvFile() MUST come before importing the engine: @/modules/engine
// pulls in the Prisma client, which reads DATABASE_URL at construction. So the env
// is loaded first, THEN the engine is imported dynamically. English-only: this is
// operator tooling, not UI.

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // .env may be absent (e.g. env vars provided by the host) — use process.env as-is.
  }

  // Dynamic import AFTER env load, so the Prisma singleton sees DATABASE_URL.
  const { runEngine } = await import("@/modules/engine");
  const result = await runEngine();

  // A compact, English operator summary (the Persian messages live in the DB rows).
  console.log("Engine run complete:");
  console.log(`  reminders:        ${result.reminders}`);
  console.log(`  archived tasks:   ${result.archived}`);
  console.log(`  abandoned:        ${result.abandoned}`);
  console.log(`  greetings:        ${result.greetings}`);
  console.log(`  sms sent:         ${result.smsSent}`);
  console.log(`  overdue alerts:   ${result.overdueAlerts}`);
  console.log(`  unfollowed alerts:${result.unfollowedAlerts}`);
  console.log(`  errors:           ${result.errors}`);
  if (result.errorDetails.length > 0) {
    console.log("  error details:");
    for (const d of result.errorDetails) console.log(`    - ${d}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Engine run failed:", err);
    process.exit(1);
  });
