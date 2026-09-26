import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { adjustTotal, adjustTotalSchema } from "@/modules/payments";

// Adjust a period's agreed total (C-7): changes only that period's total, never
// its payments. A thin gate — the payments service owns authorization
// (`financial.adjust_total`, record-scoped, rule 3) and the write.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = adjustTotalSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await adjustTotal(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
