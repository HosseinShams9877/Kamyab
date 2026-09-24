import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { updateEmployee, updateEmployeeSchema } from "@/modules/employees";

// Update an employee's profile (C-12). employees.edit is required; the service
// re-checks mobile uniqueness and department validity server-side.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateEmployeeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await updateEmployee(id, parsed.data);
  if (!result.ok) {
    const status = result.field === "id" ? 404 : 409;
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status },
    );
  }
  return NextResponse.json({ ok: true });
}
