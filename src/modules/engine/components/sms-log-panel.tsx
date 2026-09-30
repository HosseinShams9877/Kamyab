"use client";

import { useState } from "react";
import type { SmsLogView, SmsLogRow } from "../engine.types";
import { toPersianDigits } from "@/lib/digits";
import { toJalali, formatJalali } from "@/lib/jalali";

// SMS log panel for the engine page (C-14). Independent of the settings
// module's status view: it shows the same underlying SmsMessage rows with a
// per-status filter, so a manager can diagnose a failed delivery — e.g. an
// invalid gateway key, or a customer with an unparseable mobile — without
// leaving the engine run log. Display-only; no client-side fetching.

type Filter = "all" | "SENT" | "QUEUED" | "FAILED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "SENT", label: "ارسال‌شده" },
  { key: "QUEUED", label: "در صف" },
  { key: "FAILED", label: "ناموفق" },
];

const STATUS_LABELS: Record<SmsLogRow["status"], string> = {
  SENT: "ارسال‌شده",
  QUEUED: "در صف",
  FAILED: "ناموفق",
};

const STATUS_BADGE: Record<SmsLogRow["status"], string> = {
  SENT: "bg-success-bg text-success",
  QUEUED: "bg-info-bg text-info",
  FAILED: "bg-error-bg text-error",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success-bg text-success"
      : tone === "error"
        ? "bg-error-bg text-error"
        : "bg-info-bg text-info";
  return (
    <div className={`flex-1 rounded-control px-4 py-3 text-center ${toneClass}`}>
      <div className="text-2xl font-bold">{toPersianDigits(String(value))}</div>
      <div className="mt-1 text-xs">{label}</div>
    </div>
  );
}

export function SmsLogPanel({ log }: { log: SmsLogView }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered =
    filter === "all" ? log.rows : log.rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="ارسال‌شده" value={log.sent} tone="success" />
        <Stat label="در صف" value={log.queued} tone="info" />
        <Stat label="ناموفق" value={log.failed} tone="error" />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-text">آخرین پیامک‌ها</h3>
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const isActive = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`min-h-[36px] whitespace-nowrap rounded-control px-3 text-xs transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "border border-border text-text-secondary hover:bg-page"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            پیامکی در این وضعیت وجود ندارد.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {filtered.map((m) => (
              <li key={m.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-text" dir="ltr">
                    {m.recipient}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-badge px-2 py-0.5 text-xs ${STATUS_BADGE[m.status]}`}
                    >
                      {STATUS_LABELS[m.status]}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {m.templateKey} • {formatJalali(toJalali(m.createdAt))}
                    </span>
                  </div>
                </div>
                {m.body && (
                  <p className="mt-1 text-xs text-text-secondary break-words">
                    {m.body}
                  </p>
                )}
                {m.error && (
                  <p className="mt-1 text-xs text-error break-words" dir="rtl">
                    {m.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}