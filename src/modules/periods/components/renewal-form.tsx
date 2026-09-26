"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits, toEnglishDigits } from "@/lib/digits";
import { parseJalali, addMonths, formatJalali } from "@/lib/jalali";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { RenewalMeta } from "../periods.types";

// The renewal form (C-9), embedded in the active period's card. Start date
// defaults to the current period's expiry (the new span begins where the old one
// ends); the duration is required and drives the read-only computed expiry, which
// this leaf previews live with the same Jalali calendar-month math the server
// uses. On save it POSTs to the guarded /api/cases/renewals route, which closes
// the previous period and opens the next in one transaction (rule 4); the server
// re-checks permission on every request (rule 3).

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const label = "mb-1 block text-xs text-text-secondary";

export function RenewalForm({
  caseId,
  meta,
}: {
  caseId: string;
  meta: RenewalMeta;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDuration =
    meta.durations.find((d) => d.isDefault)?.id ?? meta.durations[0]?.id ?? "";
  const [startDate, setStartDate] = useState(meta.defaultStartDate ?? "");
  const [durationId, setDurationId] = useState(defaultDuration);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const working = busy || pending;

  // Live expiry preview: the same calendar-month add the server applies. Empty
  // until both a valid start date and a duration are chosen.
  const duration = meta.durations.find((d) => d.id === durationId) ?? null;
  const startJ = parseJalali(toEnglishDigits(startDate.trim()));
  const computedExpiry =
    startJ && duration
      ? formatJalali(addMonths(startJ, duration.monthCount), { persianDigits: false })
      : null;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, startDate, durationId, renewalAmount: amount, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "خطا در ثبت تمدید.");
        return;
      }
      setAmount("");
      setNote("");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        تمدید دوره
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
          <label className={label} htmlFor="rnw-start">تاریخ شروع دورهٔ جدید</label>
          <input
            id="rnw-start"
            type="text"
            dir="ltr"
            placeholder="۱۴۰۴/۰۵/۰۱"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={working}
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="rnw-duration">مدت اعتبار</label>
          <select
            id="rnw-duration"
            value={durationId}
            onChange={(e) => setDurationId(e.target.value)}
            disabled={working || meta.durations.length === 0}
            className={field}
          >
            {meta.durations.length === 0 && <option value="">—</option>}
            {meta.durations.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="rnw-expiry">تاریخ انقضا (محاسبه‌شده)</label>
          <input
            id="rnw-expiry"
            type="text"
            dir="ltr"
            readOnly
            value={computedExpiry ? toPersianDigits(computedExpiry) : "—"}
            className={`${field} bg-disabled-bg`}
          />
        </div>
        <div>
          <label className={label} htmlFor="rnw-amount">مبلغ تمدید (تومان، اختیاری)</label>
          <input
            id="rnw-amount"
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={working}
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="rnw-note">یادداشت (اختیاری)</label>
          <input
            id="rnw-note"
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
          disabled={working || !startDate.trim() || !durationId}
          className={primaryBtn}
        >
          ثبت تمدید
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={working} className={ghostBtn}>
          انصراف
        </button>
      </div>
    </div>
  );
}
