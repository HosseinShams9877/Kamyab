"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Row actions for the services list (B-1): activate/deactivate toggle, delete,
// and a link to the detail page. Delete is refused server-side when the service
// has cases — the returned Persian message is shown inline.

type Props = {
  id: string;
  status: boolean;
  canEdit: boolean;
};

const btn =
  "rounded-control px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

export function ServiceRowActions({ id, status, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(
    method: string,
    body?: unknown,
  ): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(`/api/services/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    try {
      return (await res.json()) as { ok: boolean; message?: string };
    } catch {
      return { ok: res.ok };
    }
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const data = await call("PATCH", { status: !status });
    setBusy(false);
    if (data.ok) router.refresh();
    else setError(data.message ?? "عملیات انجام نشد.");
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const data = await call("DELETE");
    setBusy(false);
    if (data.ok) router.refresh();
    else setError(data.message ?? "حذف انجام نشد.");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Link href={`/services/${id}`} className="text-sm text-primary hover:underline">
          مدیریت
        </Link>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={`${btn} text-text-secondary hover:bg-page`}
            >
              {status ? "غیرفعال‌سازی" : "فعال‌سازی"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className={`${btn} text-error hover:bg-error-bg`}
            >
              حذف
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
