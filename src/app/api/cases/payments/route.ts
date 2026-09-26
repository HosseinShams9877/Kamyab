import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { recordPayment, paymentCreateSchema } from "@/modules/payments";

// Record a payment (C-7). A thin gate: the payments service owns authorization
// (record-scoped, rule 3) and every business rule; this validates the shape and
// maps the discriminated result to a status code.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = paymentCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await recordPayment(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
