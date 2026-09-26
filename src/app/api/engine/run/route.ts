import { NextResponse } from "next/server";
import { runEngine } from "@/modules/engine";

// Trigger #1 for the automatic engine (C-14): an unattended HTTP entry point an
// external scheduler (cron / Windows Task Scheduler) calls every 6 hours — see
// SETUP.md. It is NOT a user action, so there is deliberately NO getCurrentUser /
// permission gate here (rule 3 governs user-facing pages, not this machine hook).
// Access is instead guarded by a shared secret in the ENGINE_SECRET env var,
// compared against the `x-engine-secret` header. The runner is idempotent — its
// DB unique indexes make a double-fire harmless — so a retrying scheduler is safe.
//
// force-dynamic: this must run on every request, never be statically optimized or
// cached, since it performs writes and reads live data.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.ENGINE_SECRET;
  // A missing/blank server secret is a misconfiguration — refuse rather than run
  // an unguarded engine.
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "ENGINE_SECRET is not configured." },
      { status: 500 },
    );
  }
  if (request.headers.get("x-engine-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await runEngine();
  return NextResponse.json({ ok: true, result });
}
