import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { updateTask, deleteTask, taskUpdateSchema } from "@/modules/tasks";

// Update or delete a task (C-11), addressed by id. The tasks service authorizes
// (record-scoped, rule 3) and enforces the rules (owner active, related case
// active, the no-follow-up delete rule). Next 15 hands params as a Promise.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = taskUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const { id } = await params;
  const result = await updateTask(user, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const result = await deleteTask(user, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
