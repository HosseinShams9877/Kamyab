import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getServiceCaseMeta } from "@/modules/cases";

// Live service meta for the case-registration form (C-4): whether the service is
// renewable, its initial stage count (the hint), and its active validity
// durations. Guarded the same as case creation — the form fetches this as the
// user picks a service. 404 when the service is unknown or inactive.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "cases.create")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const serviceId = new URL(request.url).searchParams.get("serviceId") ?? "";
  if (!serviceId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const meta = await getServiceCaseMeta(serviceId);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({ ok: true, meta });
}
