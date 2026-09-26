import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { restoreCase, caseRestoreSchema } from "@/modules/cases";

// Restore a cancelled case (C-8) — MANAGER ONLY. Thin, guarded handler; the role
// gate + the atomic restore transaction (case → IN_PROGRESS, current period
// reactivated) live in the service (rule 3/4). The role is passed from the
// authenticated user. 422 = malformed input; 403/404/409 come from the service.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = caseRestoreSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await restoreCase(user, user.role, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
