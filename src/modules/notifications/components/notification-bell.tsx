"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import { toJalali, formatJalali } from "@/lib/jalali";
import type { NotificationRow } from "../notifications.types";

// The header notification bell: shows the unread count, opens a dropdown with
// the latest items, marks them as read when opened, and links to the standalone
// notifications page ("مشاهده همه"). The target path is passed in as `basePath`
// so the manager shell can link to /notifications and the employee shell to
// /employee/notifications (the two route groups cannot share one URL).
//
// The API returns ISO strings (JSON has no Date), so every render wraps the
// value in `new Date()` before formatting with the shared Jalali helper.
//
// Fully responsive: on small viewports the dropdown uses `fixed` positioning to
// span the screen (with a small inset), avoiding overflow off the left/right
// edge. On `sm+` it becomes a normal anchored absolute dropdown.

const POLL_MS = 60_000;

export function NotificationBell({
  initialUnread,
  basePath = "/notifications",
}: {
  initialUnread: number;
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Poll the unread count every minute.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/notifications", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; unread?: number };
        if (!cancelled && data.ok && typeof data.unread === "number") {
          setUnread(data.unread);
        }
      } catch {
        /* silent */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openDropdown() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          items: NotificationRow[];
          unread: number;
        };
        if (data.ok) {
          setItems(data.items);
          setUnread(data.unread);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function markAll() {
    await fetch("/api/notifications/mark-read", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => router.refresh());
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openDropdown}
        aria-label="اعلان‌ها"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-control text-text transition-colors hover:bg-page"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {toPersianDigits(String(unread))}
          </span>
        )}
      </button>

      {open && (
        <div
          className={
            // Mobile: fixed, spanning the viewport with a small inset.
            // sm+: absolute, anchored to the bell with a fixed width.
            "fixed inset-x-2 top-16 z-50 rounded-card border border-border bg-card shadow-card " +
            "sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 sm:w-80"
          }
          role="dialog"
          aria-label="اعلان‌ها"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium text-text">اعلان‌ها</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-primary hover:underline"
              >
                خواندن همه
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto sm:max-h-96">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-text-secondary">
                در حال بارگذاری…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-secondary">
                اعلانی وجود ندارد.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`px-3 py-2.5 text-sm ${
                      n.read ? "text-text-secondary" : "text-text"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{n.message}</p>
                    <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                      {toPersianDigits(
                        formatJalali(toJalali(new Date(n.createdAt)), {
                          persianDigits: false,
                        }),
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2 text-center">
            <Link
              href={basePath}
              onClick={() => setOpen(false)}
              className="block py-1 text-sm text-primary hover:underline"
            >
              مشاهده همه
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}