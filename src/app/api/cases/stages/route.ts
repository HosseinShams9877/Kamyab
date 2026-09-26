import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { addExceptionalStage, addStageSchema } from "@/modules/cases";

// Add an exceptional per-case stage to the current period (C-6). Thin, guarded
// handler: authenticate -> parse -> service -> respond. Authorization is
// record-scoped (needs stages.add_exceptional on this case), so it happens in
// the service, which reads the case's owner (rule 3). 422 = malformed input;
// 403/404/409 come from the service result.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = addStageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await addExceptionalStage(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
