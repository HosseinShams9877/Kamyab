import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { birthdaySchema, saveBirthday } from "@/modules/settings";

// Birthday greeting settings (B-9): master switch + send hour.

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = birthdaySchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, field: first?.path[0], message: first?.message },
      { status: 422 },
    );
  }

  await saveBirthday(parsed.data);
  return NextResponse.json({ ok: true });
}
