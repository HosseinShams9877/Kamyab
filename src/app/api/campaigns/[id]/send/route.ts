import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { sendCampaign } from "@/modules/campaigns";

// Trigger a campaign send. The audience is snapshotted (idempotent) and the
// campaign moves to RUNNING; the engine's next run dispatches the queued rows.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const result = await sendCampaign(user, id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code },
    );
  }
  return NextResponse.json({ ok: true, recipientCount: result.recipientCount });
}