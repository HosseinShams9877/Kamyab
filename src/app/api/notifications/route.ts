import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { listMyNotifications, countMyUnread } from "@/modules/notifications";

// GET /api/notifications — the current user's notifications + unread count.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  const [result, unread] = await Promise.all([
    listMyNotifications(user.id, Number.isFinite(limit) ? limit : 20),
    countMyUnread(user.id),
  ]);
  return NextResponse.json({ ok: true, items: result.items, unread });
}