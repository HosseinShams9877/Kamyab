"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";

// The cancel-case control + dialog (C-8). Client leaf: it imports client-safe
// libs (digits, money) and posts to /api/cases/cancel — never the cases barrel
// (which pulls in Prisma). Authorization + the atomic cancel transaction live in
// the service (rule 3/4); this only collects a mandatory reason + optional note
// and shows the warning summary. The confirm button stays disabled until a
// reason is picked. Reasons/summary figures are computed on the server (the page).

const NOTE_MAX = 500;

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const label = "mb-1 block text-xs text-text-secondary";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "min-h-[44px] rounded-control border border-error px-4 text-sm text-error hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-50";

export function CaseCancelDialog({
  caseId,
  reasons,
  openStages,
  openTasks,
  balance,
}: {
  caseId: string;
  reasons: { id: string; title: string }[];
  openStages: number;
  openTasks: number;
  balance: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  // PLACEHOLDER_BODY
  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, cancellationReasonId: reasonId, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "لغو پرونده انجام نشد.");
        return;
      }
      setOpen(false);
      setReasonId("");
      setNote("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={dangerBtn} onClick={() => setOpen(true)}>
        لغو پرونده
      </button>
    );
  }

  // Warning summary (C-8): the open work + outstanding balance the manager is
  // about to walk away from. Only the parts that apply are shown.
  const parts: string[] = [];
  if (openStages > 0) parts.push(`${toPersianDigits(String(openStages))} مرحله باز`);
  if (openTasks > 0) parts.push(`${toPersianDigits(String(openTasks))} کار باز`);
  if (balance !== null && balance > 0) parts.push(`${formatToman(balance)} مانده`);
  const summary =
    parts.length > 0
      ? `این پرونده ${parts.join("، ")} دارد.`
      : "این پرونده کار باز یا مانده‌ای ندارد.";

  return (
    <div className="w-full max-w-lg rounded-card border border-border bg-card p-4 shadow-card">
      <h3 className="mb-2 text-sm font-medium text-text">لغو پرونده</h3>

      <div className="mb-3 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning">
        {summary} با لغو، مسیر قفل و کارهای باز بسته می‌شوند؛ پرداخت‌ها و مبلغ کل
        تغییری نمی‌کنند و پرونده حذف نمی‌شود.
      </div>

      {error && (
        <div className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      <div className="mb-3">
        <label className={label} htmlFor="cancel-reason">
          دلیل لغو
        </label>
        <select
          id="cancel-reason"
          className={field}
          value={reasonId}
          disabled={working}
          onChange={(e) => setReasonId(e.target.value)}
        >
          <option value="">— انتخاب دلیل —</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className={label} htmlFor="cancel-note">
          یادداشت (اختیاری)
        </label>
        <textarea
          id="cancel-note"
          className={`${field} min-h-[80px] py-2`}
          value={note}
          maxLength={NOTE_MAX}
          disabled={working}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={dangerBtn}
          disabled={working || reasonId === ""}
          onClick={submit}
        >
          {working ? "در حال لغو…" : "تأیید لغو"}
        </button>
        <button
          type="button"
          className={ghostBtn}
          disabled={working}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          انصراف
        </button>
      </div>
    </div>
  );
}
