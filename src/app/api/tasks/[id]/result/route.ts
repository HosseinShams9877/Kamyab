import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { recordResult, recordResultSchema } from "@/modules/followups";

// Record a follow-up result for a task (C-11 / B-6), addressed by task id. The
// followups service authorizes (record-scoped, rule 3) and runs the whole thing
// as one transaction: close the task, write the follow-up, apply the effect on the
// active period, and optionally create the next task. Next 15 hands params as a Promise.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = recordResultSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const { id } = await params;
  const result = await recordResult(user, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
