import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { createCustomer, createCustomerSchema } from "@/modules/customers";

// Thin, guarded routes (folder-structure.md: parse -> authorize -> service ->
// respond). No domain rules live here — the customers service owns them, and the
// server guard (`can`) is the real gate regardless of what the UI shows.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "customers.create")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = createCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await createCustomer(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
