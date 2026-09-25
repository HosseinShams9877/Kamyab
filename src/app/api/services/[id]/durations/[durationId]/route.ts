import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  deleteDuration,
  updateDuration,
  durationUpdateSchema,
  PathRuleError,
} from "@/modules/paths";

// Single validity-duration routes (B-3). PATCH edits (a used duration is
// rename-only — the service freezes month count + default); DELETE removes it
// (refused with a Persian message when the duration is in use).

type Ctx = { params: Promise<{ id: string; durationId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id, durationId } = await params;
  const parsed = durationUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    await updateDuration(id, durationId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json(
        { ok: false, field: err.field, message: err.message },
        { status: 409 },
      );
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
  const { id, durationId } = await params;
  try {
    await deleteDuration(id, durationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
