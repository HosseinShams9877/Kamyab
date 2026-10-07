import { requireUser } from "@/modules/auth";
import { listMyNotifications, markAllMyRead } from "@/modules/notifications";
import { ensureStageDueNotifications } from "@/modules/cases";
import { NotificationsList } from "@/modules/notifications/components/notifications-list";
import { toPersianDigits } from "@/lib/digits";

// Employee notifications inbox. Lives under /employee/* so it inherits the
// employee shell and does not collide with the manager group's /notifications.
export const dynamic = "force-dynamic";

export default async function EmployeeNotificationsPage() {
  const user = await requireUser();

  // Make sure any stage-due notifications that are due RIGHT NOW exist before
  // we read them (no engine run needed for the in-app channel).
  await ensureStageDueNotifications();

  await markAllMyRead(user.id);
  const { items } = await listMyNotifications(user.id, 100);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">اعلان‌ها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            همهٔ اعلان‌های شما از سامانه
          </p>
        </div>
        {items.length > 0 && (
          <span className="rounded-badge bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {toPersianDigits(String(items.length))} اعلان
          </span>
        )}
      </div>

      <NotificationsList items={items} dashboardHref="/employee" />
    </main>
  );
}