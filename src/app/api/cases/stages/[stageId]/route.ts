import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import {
  runStageAction,
  deleteStage,
  moveStage,
  stageActionSchema,
  stageStructuralSchema,
} from "@/modules/cases";

// One stage's actions (C-6), addressed by stage id:
//   POST   — a status transition (start/done/reject/not_needed/reopen/note)
//   PATCH  — reorder an exceptional stage (move_up / move_down)
//   DELETE — remove a never-acted exceptional stage
// Every handler is a thin gate; the cases service owns authorization (record-
// scoped, rule 3) and every business rule. Next 15 hands params as a Promise.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { stageId } = await params;
  const parsed = stageActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await runStageAction(user, stageId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { stageId } = await params;
  const parsed = stageStructuralSchema.safeParse(await request.json());
  if (!parsed.success || parsed.data.op === "delete") {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const direction = parsed.data.op === "move_up" ? "up" : "down";
  const result = await moveStage(user, stageId, direction);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { stageId } = await params;
  const result = await deleteStage(user, stageId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
