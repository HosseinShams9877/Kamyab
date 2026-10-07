import { prisma } from "@/lib/db";
import type { NotificationRow } from "./notifications.types";

// ALL Prisma access for the notifications domain.

export async function findMyNotifications(
  userId: string,
  limit: number,
): Promise<NotificationRow[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      message: true,
      read: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export function markAllRead(userId: string): Promise<{ count: number }> {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export function markOneRead(
  userId: string,
  notificationId: string,
): Promise<{ count: number }> {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

/** Delete ONE notification scoped to the user (rule 3 — no cross-user delete). */
export async function deleteOne(
  userId: string,
  notificationId: string,
): Promise<number> {
  const res = await prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
  return res.count;
}