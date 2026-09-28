import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { markAllMyRead, markMyNotificationRead } from "@/modules/notifications";

// POST /api/notifications/mark-read — mark one or all of the current user's
// notifications as read. Body: { id?: string } (omit for "all").
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (body.id) {
    await markMyNotificationRead(user.id, body.id);
  } else {
    await markAllMyRead(user.id);
  }
  return NextResponse.json({ ok: true });
}