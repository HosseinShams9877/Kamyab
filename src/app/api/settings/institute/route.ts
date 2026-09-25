import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { instituteInfoSchema, saveInstituteInfo } from "@/modules/settings";

// Institute information (B-10). Thin guarded route: authorize -> validate ->
// service -> respond. `settings.edit` is the real gate regardless of the UI.

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "settings.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = instituteInfoSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, field: first?.path[0], message: first?.message },
      { status: 422 },
    );
  }

  await saveInstituteInfo(parsed.data);
  return NextResponse.json({ ok: true });
}
