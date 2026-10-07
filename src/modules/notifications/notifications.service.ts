import * as repo from "./notifications.repository";
import type { NotificationListResult } from "./notifications.types";

// Business logic for the notifications inbox.

export async function listMyNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationListResult> {
  const [items, unread] = await Promise.all([
    repo.findMyNotifications(userId, limit),
    repo.countUnread(userId),
  ]);
  return { items, unread };
}

export function countMyUnread(userId: string): Promise<number> {
  return repo.countUnread(userId);
}

export function markAllMyRead(userId: string): Promise<{ count: number }> {
  return repo.markAllRead(userId);
}

export function markMyNotificationRead(
  userId: string,
  notificationId: string,
): Promise<{ count: number }> {
  return repo.markOneRead(userId, notificationId);
}

/** Delete one of MY notifications. Returns true when a row was removed. */
export async function deleteMyNotification(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const count = await repo.deleteOne(userId, notificationId);
  return count > 0;
}