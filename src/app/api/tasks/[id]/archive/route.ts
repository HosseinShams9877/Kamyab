import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { setTaskArchived } from "@/modules/tasks";

// Archive / unarchive a task (C-11 manual controls; auto-archive is Phase 15).
// The tasks service authorizes (record-scoped, rule 3) and rejects a redundant
// archive/unarchive. Next 15 hands params as a Promise.
const bodySchema = z.object({ archived: z.boolean() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "درخواست نامعتبر است." }, { status: 422 });
  }

  const { id } = await params;
  const result = await setTaskArchived(user, id, parsed.data.archived);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
