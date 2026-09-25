import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  updateCustomer,
  updateCustomerSchema,
  deleteCustomer,
} from "@/modules/customers";

// Edit / delete a single customer. The customers service owns the rules
// (mobile uniqueness on edit; delete only when the customer has no case); the
// guard here is the real permission gate.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "customers.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await updateCustomer(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "customers.deactivate")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteCustomer(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
