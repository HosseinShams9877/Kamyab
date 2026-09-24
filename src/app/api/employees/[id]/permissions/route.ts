import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getEmployee,
  getPermissionsView,
  permissionsSchema,
  updatePermissions,
} from "@/modules/employees";

// Read (GET) and save (PUT) an employee's permission matrix. Viewing needs
// employees.view; changing needs employees.change_permissions. The service and
// the permissions module reduce the submitted map to stored differences.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.view")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ ok: false }, { status: 404 });

  const view = await getPermissionsView(id, employee.role);
  return NextResponse.json({ ok: true, ...view });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.change_permissions")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = permissionsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await updatePermissions(id, parsed.data.permissions);
  if (!result.ok) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, effective: result.effective });
}
