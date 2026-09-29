import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import {
  changeCaseOwner,
  caseChangeOwnerSchema,
} from "@/modules/cases";

// Reassign a case to another active employee (C-5 header action). Thin, guarded
// handler: parse -> service -> respond. The service owns every rule (permission,
// cancelled-state block, active-owner check) and runs the whole thing in one
// transaction with the history record (rule 3/4). The `[id]` in the URL is
// authoritative for the case id; the body's caseId is overwritten with it so a
// mismatched payload cannot target a different case.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = caseChangeOwnerSchema.safeParse({ ...body, caseId: id });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        field: parsed.error.issues[0]?.path?.[0] ?? null,
        message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.",
      },
      { status: 422 },
    );
  }

  const result = await changeCaseOwner(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code },
    );
  }
  return NextResponse.json({ ok: true, movedTasks: result.movedTasks });
}