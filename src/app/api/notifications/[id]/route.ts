import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { deleteMyNotification } from "@/modules/notifications";

// DELETE /api/notifications/[id] — remove one of the current user's
// notifications. Scoped to the caller on the server (rule 3).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteMyNotification(user.id, id);
  if (!deleted) {
    return NextResponse.json(
      { ok: false, message: "اعلان یافت نشد." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}