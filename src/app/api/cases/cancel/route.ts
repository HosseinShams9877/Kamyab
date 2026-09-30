import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { cancelCase, caseCancelSchema } from "@/modules/cases";
import { cancelOpenTasksForCaseTx } from "@/modules/tasks";

// Cancel a case (C-8). Thin, guarded handler. Authorization + the atomic cancel
// transaction (case → CANCELLED, active period → CANCELLED, open tasks → CANCELLED
// + owner notifications) live in the service (rule 3/4). The tasks tx-seam is
// INJECTED here rather than imported by the cases service: tasks already depends
// on cases, so a cases→tasks import would cycle (rule 9). 422 = malformed input;
// 403/404/409 come from the service result.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = caseCancelSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.",
      },
      { status: 422 },
    );
  }

  const result = await cancelCase(user, parsed.data, cancelOpenTasksForCaseTx);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code },
    );
  }
  return NextResponse.json({ ok: true });
}