import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  deleteReminderRule,
  updateReminderRule,
  reminderRuleUpdateSchema,
  ServiceRuleError,
} from "@/modules/services";

// Single reminder-rule routes (B-4). PATCH edits a rule (including the active
// toggle); DELETE removes it. Both verify the rule belongs to the service.

type Ctx = { params: Promise<{ id: string; ruleId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id, ruleId } = await params;
  const parsed = reminderRuleUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    await updateReminderRule(id, ruleId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceRuleError) {
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
  const { id, ruleId } = await params;
  try {
    await deleteReminderRule(id, ruleId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
