import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { setPassword, setPasswordSchema } from "@/modules/employees";

// Set a NEW password for an employee (C-12). The manager can only set a new
// value — the current password is a one-way hash and is never returned.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = setPasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "رمز عبور باید حداقل ۸ نویسه باشد." },
      { status: 422 },
    );
  }

  await setPassword(id, parsed.data.password);
  return NextResponse.json({ ok: true });
}
