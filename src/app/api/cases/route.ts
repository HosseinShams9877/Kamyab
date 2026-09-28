import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth";
import { can, scopeByOwnership } from "@/modules/permissions";
import { registerCase, caseCreateSchema } from "@/modules/cases";

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

// Register a case (C-4). Thin, guarded handler: parse -> authorize -> service ->
// respond. The cases service owns every rule; `can` is the real gate regardless
// of what the UI shows (rule 3). 422 = malformed input, 409 = a business rule
// (invalid reference, missing/invalid duration) the schema cannot express.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!can(user, "cases.create")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = await request.json();
  const parsed = caseCreateSchema.safeParse(body);
  if (!parsed.success) {
    // DEBUG: log the exact Zod failure and the raw body to the terminal.
    console.error("=== ZOD ERROR on POST /api/cases ===");
    console.error("RAW BODY:", JSON.stringify(body, null, 2));
    console.error("ZOD ISSUES:", JSON.stringify(parsed.error.issues, null, 2));
    return NextResponse.json(
      {
        ok: false,
        field: parsed.error.issues[0]?.path?.[0] ?? null,
        message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.",
      },
      { status: 422 },
    );
  }

  const result = await registerCase(user.id, parsed.data);
  if (!result.ok) {
    // DEBUG: log the service-level rule failure.
    console.error("=== SERVICE ERROR on POST /api/cases ===");
    console.error("FIELD:", result.field, "MESSAGE:", result.message);
    return NextResponse.json(
      { ok: false, field: result.field, message: result.message },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { ok: true, id: result.id, number: result.number },
    { status: 201 },
  );
}