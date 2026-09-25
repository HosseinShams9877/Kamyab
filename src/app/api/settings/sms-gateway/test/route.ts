import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { testGateway } from "@/modules/settings";

// Test the SMS gateway configuration (B-10). This checks completeness only — no
// message is sent (real delivery is the Phase 15 engine adapter's job).

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const result = await testGateway();
  return NextResponse.json(result);
}
