// Domain types for the notifications module. Notifications are produced by other
// modules (cases, tasks, employees, engine) and consumed read-only here.

export type NotificationRow = {
  id: string;
  message: string;
  read: boolean;
  /** ISO date string — dates cross the JSON boundary as strings; the UI wraps
   *  it in `new Date()` before formatting. */
  createdAt: string;
};

export type NotificationListResult = {
  items: NotificationRow[];
  unread: number;
};