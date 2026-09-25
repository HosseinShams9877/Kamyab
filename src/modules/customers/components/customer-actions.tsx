"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildDeleteBlockedMessage } from "@/modules/customers/customers.guards";

// Delete / deactivate controls for a customer (C-3). A customer with cases can
// only be deactivated (delete is disabled with a Persian count message); a
// customer with no case can be fully deleted with confirmation. The server
// re-enforces both rules regardless of what is shown here.

type Props = {
  customerId: string;
  status: boolean;
  caseCount: number;
};

export function CustomerActions({ customerId, status, caseCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = caseCount === 0;

  async function toggleStatus() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: !status }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError("عملیات ناموفق بود. دوباره تلاش کنید.");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("این مشتری برای همیشه حذف شود؟")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (res.ok && data.ok) {
        router.push("/customers");
        router.refresh();
        return;
      }
      setError(data.message ?? "حذف ناموفق بود.");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={busy}
          className="min-h-[44px] rounded-control border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-page disabled:opacity-60 sm:min-h-0 sm:py-1.5"
        >
          {status ? "غیرفعال کردن" : "فعال کردن"}
        </button>

        {canDelete ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="min-h-[44px] rounded-control border border-error px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error-bg disabled:opacity-60 sm:min-h-0 sm:py-1.5"
          >
            حذف مشتری
          </button>
        ) : (
          <div>
            <button
              type="button"
              disabled
              className="min-h-[44px] cursor-not-allowed rounded-control border border-border px-4 py-2 text-sm font-medium text-disabled sm:min-h-0 sm:py-1.5"
            >
              حذف مشتری
            </button>
            <p className="mt-1.5 text-sm text-text-secondary">
              {buildDeleteBlockedMessage(caseCount)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
