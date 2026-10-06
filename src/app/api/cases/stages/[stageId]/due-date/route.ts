import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { setStageDueDate, setStageDueDateSchema } from "@/modules/cases";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { stageId } = await params;
  const parsed = setStageDueDateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.",
      },
      { status: 422 },
    );
  }

  const result = await setStageDueDate(user, stageId, parsed.data.dueDate);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code },
    );
  }
  return NextResponse.json({ ok: true });
}