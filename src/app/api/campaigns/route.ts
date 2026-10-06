import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { createCampaign, campaignCreateSchema } from "@/modules/campaigns";

// Create a campaign. Thin, guarded handler: parse -> authorize -> service.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        field: parsed.error.issues[0]?.path?.[0] ?? null,
        message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.",
      },
      { status: 422 },
    );
  }

  const result = await createCampaign(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}