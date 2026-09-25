import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getService } from "@/modules/services";
import { addStage, stageCreateSchema, PathRuleError } from "@/modules/paths";

// Path-stage collection route (B-2). POST adds a stage to the service's initial
// or renewal path. The route loads the service (owned by the services module) to
// supply the `renewable` flag the paths service needs to gate the renewal path.

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
  const parsed = stageCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }
  try {
    const result = await addStage(id, parsed.data, service.renewable);
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    if (err instanceof PathRuleError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
