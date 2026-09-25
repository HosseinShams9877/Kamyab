import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  smsTemplateSchema,
  updateTemplate,
  SettingsRuleError,
} from "@/modules/settings";

// Update one SMS template body (B-10). Empty body is allowed (event skipped).

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { eventKey } = await params;
  const parsed = smsTemplateSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, message: first?.message ?? "متن معتبر نیست." },
      { status: 422 },
    );
  }

  try {
    await updateTemplate(eventKey, parsed.data.body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SettingsRuleError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 404 },
      );
    }
    throw err;
  }
}
