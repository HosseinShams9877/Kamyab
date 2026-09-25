import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  createService,
  listServices,
  serviceCreateSchema,
} from "@/modules/services";

// Thin, guarded routes (folder-structure.md: parse -> authorize -> service ->
// respond). Domain rules live in the services service; `can` is the real gate
// regardless of what the UI shows.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.view")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const services = await listServices();
  return NextResponse.json({ ok: true, services });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "services.edit")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = serviceCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "اطلاعات واردشده معتبر نیست." },
      { status: 422 },
    );
  }

  const result = await createService(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
