import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { deactivateEmployee, deactivateSchema } from "@/modules/employees";

// Deactivate an employee (C-12), transferring their active work to a successor
// when required. The acting user's id comes from the session (never the body),
// so the "no self-deactivation" guard cannot be spoofed. A blocked attempt
// returns 409 with a Persian reason (and, when a successor is needed, the
// workload counts so the UI can prompt for one).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "employees.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = deactivateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }
  const successorId = parsed.data.successorId?.trim() || null;

  const result = await deactivateEmployee(user.id, id, successorId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
