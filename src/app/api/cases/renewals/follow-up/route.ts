import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { recordRenewalFollowUp } from "@/modules/cases";
import { renewalFollowUpSchema } from "@/modules/periods";

// Record a renewal follow-up (C-9): sets the active period's follow-up status and
// records the note in history (it does NOT create a FollowUp row). Thin, guarded
// handler; authorization (renewals.record_followup on this case) is in the service.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = renewalFollowUpSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await recordRenewalFollowUp(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
