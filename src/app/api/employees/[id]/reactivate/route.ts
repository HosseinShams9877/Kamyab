import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { reactivateEmployee } from "@/modules/employees";

// Reactivate a deactivated employee (C-12: employees are never deleted, only
// deactivated — so they can be brought back). Requires employees.edit.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  await reactivateEmployee(id);
  return NextResponse.json({ ok: true });
}
