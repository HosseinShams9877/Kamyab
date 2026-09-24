import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth";
import { can } from "@/modules/permissions";

// Thin, guarded route (folder-structure.md: parse -> authorize -> service ->
// respond). It demonstrates the Phase 4 deliverable: a forbidden direct request
// is rejected server-side regardless of the UI. An Employee (no employees.view
// by default) gets 403 here even if they craft the request by hand.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!can(user, "employees.view")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    select: { id: true, fullName: true, role: true, status: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ ok: true, employees });
}
