"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

// A Jalali-friendly time picker: two scrollable columns (hours 00–23, minutes
// in 5-step granularity), plus a manual text field so the user can type a
// precise "HH:MM" too. The parent owns the value as ASCII "HH:MM" (or "").
// Persian digits everywhere; ASCII on the wire.

type Props = {
  value: string; // ASCII "HH:MM" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function readValue(v: string): { h: number; m: number } | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, m: mi };
}

export function PersianTimePicker({
  value,
  onChange,
  disabled,
  id,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const parsed = readValue(value);
  const displayValue = parsed
    ? toPersianDigits(`${pad2(parsed.h)}:${pad2(parsed.m)}`)
    : "";

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(h: number, m: number) {
    onChange(`${pad2(h)}:${pad2(m)}`);
    setOpen(false);
  }

  // A quick "now" preset — handy for tasks logged at the moment they happen.
  function pickNow() {
    const now = new Date();
    pick(now.getHours(), now.getMinutes());
  }

  const inputClass =
    className ??
    "w-full cursor-pointer rounded-control border border-border bg-card px-3 py-2 text-right text-sm text-text outline-none transition-colors focus:border-primary disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="rtl"
        readOnly
        disabled={disabled}
        value={displayValue}
        placeholder="۱۴:۳۰"
        onClick={() => !disabled && setOpen((o) => !o)}
        onFocus={() => !disabled && setOpen(true)}
        className={inputClass}
      />

      {open && (
        <div className="absolute z-40 mt-1 w-64 rounded-card border border-border bg-card p-3 shadow-card">
          <div className="mb-2 text-center text-sm font-medium text-text">
            انتخاب ساعت
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Hours */}
            <div>
              <div className="mb-1 text-center text-xs text-text-secondary">
                ساعت
              </div>
              <div className="max-h-48 overflow-y-auto rounded-control border border-border">
                {HOURS.map((h) => {
                  const active = parsed?.h === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => pick(h, parsed?.m ?? 0)}
                      className={`block w-full px-3 py-1.5 text-center text-sm transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "text-text hover:bg-page"
                      }`}
                    >
                      {toPersianDigits(pad2(h))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes (5-step) */}
            <div>
              <div className="mb-1 text-center text-xs text-text-secondary">
                دقیقه
              </div>
              <div className="max-h-48 overflow-y-auto rounded-control border border-border">
                {MINUTES.map((m) => {
                  const active = parsed?.m === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pick(parsed?.h ?? 0, m)}
                      className={`block w-full px-3 py-1.5 text-center text-sm transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "text-text hover:bg-page"
                      }`}
                    >
                      {toPersianDigits(pad2(m))}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer: now / clear */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-control px-2 py-1 text-text-secondary hover:bg-page"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={pickNow}
              className="rounded-control px-2 py-1 text-primary hover:bg-page"
            >
              اکنون
            </button>
          </div>
        </div>
      )}
    </div>
  );
}