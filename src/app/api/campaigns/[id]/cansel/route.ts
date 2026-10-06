import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { cancelCampaign } from "@/modules/campaigns";

// Cancel a campaign (only from DRAFT/SCHEDULED/RUNNING).

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const result = await cancelCampaign(user, id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code },
    );
  }
  return NextResponse.json({ ok: true });
}