import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  deleteService,
  getService,
  setServiceStatus,
  updateService,
  serviceStatusSchema,
  serviceUpdateSchema,
  ServiceRuleError,
} from "@/modules/services";

// Single-service routes: PATCH handles both a full edit (B-1 form) and the quick
// active/inactive toggle from the list; DELETE hard-deletes when no case uses the
// service (the service raises a Persian rule error otherwise → 409).

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  // A status-only payload (no `name`) is the list toggle.
  if (!("name" in body)) {
    const parsed = serviceStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "اطلاعات واردشده معتبر نیست." },
        { status: 422 },
      );
    }
    await setServiceStatus(id, parsed.data.status);
    return NextResponse.json({ ok: true });
  }

  const parsed = serviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  const result = await updateService(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await params;
  const existing = await getService(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "خدمت یافت نشد." },
      { status: 404 },
    );
  }
  try {
    await deleteService(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceRuleError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }
}
