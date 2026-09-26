import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { restorePeriod } from "@/modules/cases";
import { periodActionSchema } from "@/modules/periods";

// Restore an abandoned period (C-10): ABANDONED -> ACTIVE. Thin, guarded handler;
// authorization (renewals.restore on this case) is in the service (rule 3). 422 =
// malformed input; 403/404/409 come from the service result.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = periodActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await restorePeriod(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
