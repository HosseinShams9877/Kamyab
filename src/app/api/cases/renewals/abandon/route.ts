import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { abandonPeriod } from "@/modules/cases";
import { periodActionSchema } from "@/modules/periods";

// Manually abandon an expired, past-threshold period (C-10). Thin, guarded handler;
// authorization (renewals.register on this case) + the abandonment rule live in the
// service (rule 3). 422 = malformed input; 403/404/409 come from the service result.
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

  const result = await abandonPeriod(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
