import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { setDurationActive, durationSetActiveSchema, PathRuleError } from "@/modules/paths";

// Activate / deactivate a validity duration (B-3). Deactivation is always
// allowed — even for a duration already used by cases — because it only removes
// the duration from the case-registration pick list and never touches history.

type Ctx = { params: Promise<{ id: string; durationId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id, durationId } = await params;
  const parsed = durationSetActiveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    await setDurationActive(id, durationId, parsed.data.active);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
