import { requireUser } from "@/modules/auth";
import { listMyNotifications, markAllMyRead } from "@/modules/notifications";
import { toPersianDigits } from "@/lib/digits";
import { toJalali, formatJalali } from "@/lib/jalali";
import Link from "next/link";

// Notifications inbox. One shared page for every role: employees and managers
// both read their own notifications. A soft page background, a card-based list,
// and unread rows highlighted with the primary accent.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();

  await markAllMyRead(user.id);
  const { items } = await listMyNotifications(user.id, 100);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
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

      {/* List */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`group flex gap-3 rounded-card border bg-card p-4 shadow-card transition-colors ${
                n.read
                  ? "border-border"
                  : "border-primary/30 bg-primary/[0.03]"
              }`}
            >
              {/* Icon */}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  n.read
                    ? "bg-page text-text-secondary"
                    : "bg-primary/10 text-primary"
                }`}
                aria-hidden="true"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>

              {/* Body */}
              <div className="min-w-0 flex-1">
                <p
                  className={`whitespace-pre-wrap break-words text-sm leading-6 ${
                    n.read ? "text-text-secondary" : "text-text"
                  }`}
                >
                  {n.message}
                </p>
                <p className="mt-1.5 text-xs text-text-secondary" dir="ltr">
                  {toPersianDigits(
                    formatJalali(toJalali(new Date(n.createdAt)), {
                      persianDigits: false,
                    }),
                  )}
                </p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-label="خوانده‌نشده"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Footer hint */}
      {items.length > 0 && (
        <p className="mt-6 text-center text-xs text-text-secondary">
          برای بازگشت به داشبورد، از منوی کناری استفاده کنید.
        </p>
      )}
    </main>
  );
}

/** Friendly empty state with an icon and a link back to the dashboard. */
function EmptyState() {
  return (
    <div className="rounded-card border border-border bg-card p-10 text-center shadow-card">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-page text-text-secondary">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>
      <h2 className="text-base font-bold text-text">اعلانی وجود ندارد</h2>
      <p className="mt-1.5 text-sm text-text-secondary">
        اعلان‌های جدید در همین صفحه نمایش داده می‌شوند.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex min-h-[40px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  );
}