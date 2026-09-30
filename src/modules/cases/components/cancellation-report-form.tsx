"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

// The report's Jalali date-range filter (B-5 / C-8). Client component: two
// JalaliDatePickers + an Apply button that pushes ?from=&to= onto the URL, so
// the server component re-reads the range. Kept as a separate client island so
// the rest of the report page stays a plain server component.

const label = "mb-1 block text-xs text-text-secondary";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text transition-colors hover:bg-page disabled:opacity-50";

export function CancellationReportForm({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string; // Jalali "YYYY/MM/DD" (ASCII)
  defaultTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);

  function apply() {
    setBusy(true);
    const params = new URLSearchParams();
    if (from) params.set("from", toEnglishDigits(from));
    if (to) params.set("to", toEnglishDigits(to));
    router.push(`?${params.toString()}`);
    router.refresh();
    setBusy(false);
  }

  function reset() {
    setFrom(defaultFrom);
    setTo(defaultTo);
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4 shadow-card">
      <div className="min-w-[12rem] flex-1">
        <label className={label}>از تاریخ</label>
        <JalaliDatePicker
          value={from}
          onChange={setFrom}
          placeholder="۱۴۰۴/۰۱/۰۱"
        />
      </div>
      <div className="min-w-[12rem] flex-1">
        <label className={label}>تا تاریخ</label>
        <JalaliDatePicker
          value={to}
          onChange={setTo}
          placeholder="۱۴۰۴/۱۲/۲۹"
        />
      </div>
      <button type="button" onClick={apply} disabled={busy} className={primaryBtn}>
        {busy ? "در حال اعمال…" : "اعمال"}
      </button>
      <button type="button" onClick={reset} disabled={busy} className={ghostBtn}>
        بازنشانی
      </button>
    </div>
  );
}