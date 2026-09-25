import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getService } from "@/modules/services";
import { addDuration, durationCreateSchema, PathRuleError } from "@/modules/paths";

// Validity-duration collection route (B-3). POST adds a duration; the paths
// service requires the service to be renewable (the route supplies the flag).

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await params;
  const service = await getService(id);
  if (!service) {
    return NextResponse.json({ ok: false, message: "خدمت یافت نشد." }, { status: 404 });
  }
  const parsed = durationCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    const result = await addDuration(id, parsed.data, service.renewable);
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json(
        { ok: false, field: err.field, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }
}
