import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  createReminderRule,
  reminderRuleCreateSchema,
  ServiceRuleError,
} from "@/modules/services";

// Reminder-rule collection route (B-4). POST creates a rule for the service; the
// service enforces that the service is renewable (409 otherwise).

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await params;
  const parsed = reminderRuleCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    const result = await createReminderRule(id, parsed.data);
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ServiceRuleError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }
}
