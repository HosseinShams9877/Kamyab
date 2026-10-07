"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import { toJalali, formatJalali } from "@/lib/jalali";
import type { NotificationRow } from "../notifications.types";

// Client list for the notifications inbox. Renders the rows and provides a
// per-row delete button (DELETE /api/notifications/[id]). Deleting is scoped
// to the signed-in user on the server (rule 3).

export function NotificationsList({
  items,
  dashboardHref,
}: {
  items: NotificationRow[];
  dashboardHref: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? "حذف اعلان انجام نشد.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <EmptyState dashboardHref={dashboardHref} />;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`group flex gap-3 rounded-card border bg-card p-4 shadow-card transition-colors ${
              n.read ? "border-border" : "border-primary/30 bg-primary/[0.03]"
            }`}
          >
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

            <div className="flex items-start gap-2">
              {!n.read && (
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-label="خوانده‌نشده"
                />
              )}
              <button
                type="button"
                onClick={() => remove(n.id)}
                disabled={busyId === n.id}
                aria-label="حذف اعلان"
                title="حذف"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-border text-text-secondary transition-colors hover:border-error hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === n.id ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-text-secondary">
        برای بازگشت به داشبورد، از منوی کناری استفاده کنید.
      </p>
    </div>
  );
}

function EmptyState({ dashboardHref }: { dashboardHref: string }) {
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
        href={dashboardHref}
        className="mt-5 inline-flex min-h-[40px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  );
}