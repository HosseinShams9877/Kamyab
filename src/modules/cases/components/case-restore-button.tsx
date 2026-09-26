"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The restore-case control (C-8) — rendered only for a MANAGER on a cancelled
// case (the page decides visibility; the API route + service re-check the role,
// rule 3). Client leaf: posts to /api/cases/restore, never the cases barrel.
// Uses an inline "مطمئن هستید؟" confirm, matching the other destructive actions.

const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";

export function CaseRestoreButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "بازگرداندن پرونده انجام نشد.");
        return;
      }
      setConfirming(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className={primaryBtn} onClick={() => setConfirming(true)}>
        بازگرداندن پرونده
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text">مطمئن هستید؟</span>
        <button type="button" className={primaryBtn} disabled={working} onClick={submit}>
          {working ? "در حال بازگرداندن…" : "بله، بازگردان"}
        </button>
        <button
          type="button"
          className={ghostBtn}
          disabled={working}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          انصراف
        </button>
      </div>
      {error && (
        <div className="rounded-control bg-error-bg px-3 py-2 text-sm text-error">{error}</div>
      )}
    </div>
  );
}
