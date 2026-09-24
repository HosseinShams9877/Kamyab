import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth";
import { scopeByOwnership } from "@/modules/permissions";

// Guarded, owner-scoped list (folder-structure.md thin handler). Demonstrates
// the "view all vs view own" deliverable: a Manager/Supervisor (cases.view_all)
// sees every case; an Employee (cases.view_own only) has the query narrowed to
// their own ownerId server-side, so it can never return another owner's cases.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const scope = scopeByOwnership(user, "cases");
  if (scope === null) {
    // Neither view_all nor view_own: no access to the list at all.
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const cases = await prisma.case.findMany({
    where: { ...scope },
    select: { id: true, number: true, status: true, ownerId: true },
    orderBy: { lastActivityAt: "desc" },
  });
  return NextResponse.json({ ok: true, cases });
}
