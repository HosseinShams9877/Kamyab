import { prisma } from "@/lib/db";
import type { NotificationRow } from "./notifications.types";

// ALL Prisma access for the notifications inbox. Producing notifications is
// other modules' job (in their own transactions); this repository only reads
// and marks-as-read. Dates are surfaced as ISO strings so the client can format
// them without a Date object crossing the server/client boundary.

/** A user's notifications, newest first. */
export async function findMyNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, message: true, read: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Count of unread notifications for the header badge. */
export function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Mark every unread notification of a user as read. Returns the count changed. */
export async function markAllRead(userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return res.count;
}

/** Mark a single notification as read — only if it belongs to this user. */
export async function markOneRead(
  userId: string,
  notificationId: string,
): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { id: notificationId, userId, read: false },
    data: { read: true },
  });
  return res.count;
}