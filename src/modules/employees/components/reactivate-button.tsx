"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bring a deactivated employee back (C-12: never deleted, only deactivated).
export function ReactivateButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function reactivate() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/employees/${employeeId}/reactivate`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-error">فعال‌سازی ناموفق بود.</p>}
      <button
        type="button"
        disabled={busy}
        onClick={reactivate}
        className="min-h-[44px] rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
      >
        {busy ? "در حال فعال‌سازی…" : "فعال‌سازی مجدد"}
      </button>
    </div>
  );
}
