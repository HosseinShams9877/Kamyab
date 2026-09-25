import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  moveStage,
  removeStage,
  renameStage,
  stageMoveSchema,
  stageUpdateSchema,
  PathRuleError,
} from "@/modules/paths";

// Single path-stage routes (B-2). PATCH renames ({title}) or reorders
// ({direction}); DELETE removes the stage. All verify the stage belongs to the
// service before mutating.

type Ctx = { params: Promise<{ id: string; stageId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id, stageId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    if ("direction" in body) {
      const parsed = stageMoveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, message: "اطلاعات واردشده معتبر نیست." },
          { status: 422 },
        );
      }
      await moveStage(id, stageId, parsed.data);
      return NextResponse.json({ ok: true });
    }
    const parsed = stageUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "اطلاعات واردشده معتبر نیست." },
        { status: 422 },
      );
    }
    await renameStage(id, stageId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id, stageId } = await params;
  try {
    await removeStage(id, stageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
