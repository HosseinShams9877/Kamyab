"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { FollowUpStatus } from "@/types/enums";
import { FOLLOW_UP_STATUS_LABELS } from "../lib/labels";

// The renewal follow-up form (C-9), embedded in the active period's card. It sets
// the period's follow-up status (one of the five mandatory values) and records an
// optional note in the case history — it does NOT create a FollowUp task (that is
// a distinct record-result flow, C-11). On save it POSTs to the guarded
// /api/cases/renewals/follow-up route, which the server re-authorizes (rule 3).

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const label = "mb-1 block text-xs text-text-secondary";

// The five renewal follow-up statuses, in the order the picker shows them.
const OPTIONS = Object.entries(FOLLOW_UP_STATUS_LABELS) as [FollowUpStatus, string][];

export function RenewalFollowUpForm({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: FollowUpStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>(currentStatus);
  const [note, setNote] = useState("");

  const working = busy || pending;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/renewals/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, followUpStatus, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "خطا در ثبت پیگیری.");
        return;
      }
      setNote("");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ghostBtn}>
        ثبت پیگیری
      </button>
    );
  }

  return (
    <div className="rounded-card border border-border bg-page p-4">
      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="fu-status">وضعیت پیگیری</label>
          <select
            id="fu-status"
            value={followUpStatus}
            onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}
            disabled={working}
            className={field}
          >
            {OPTIONS.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="fu-note">یادداشت (اختیاری)</label>
          <input
            id="fu-note"
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={working}
            className={field}
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={working || !followUpStatus}
          className={primaryBtn}
        >
          ثبت پیگیری
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={working} className={ghostBtn}>
          انصراف
        </button>
      </div>
    </div>
  );
}
