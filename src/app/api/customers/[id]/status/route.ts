import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { setCustomerStatus, setCustomerStatusSchema } from "@/modules/customers";

// Activate / deactivate a customer (C-3). Deactivation removes a customer from
// the case-registration pick list but leaves its page and history intact; it is
// always allowed (unlike an employee, no work transfer is needed).

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "customers.deactivate")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = setCustomerStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  await setCustomerStatus(id, parsed.data.status);
  return NextResponse.json({ ok: true });
}
