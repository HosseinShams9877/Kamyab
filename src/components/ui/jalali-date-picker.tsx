"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  compareJalali,
  formatJalali,
  monthLength,
  parseJalali,
  toGregorianDate,
  todayJalali,
  type JalaliDate,
} from "@/lib/jalali";
import { toPersianDigits } from "@/lib/digits";

// A Jalali (Shamsi) date picker with three views: days, months, years. Clicking
// the header title toggles between them. The parent owns the value as an ASCII
// "YYYY/MM/DD" string (or ""). Calendar math comes from @/lib/jalali.

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

const MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

type ViewMode = "days" | "months" | "years";

function readValue(v: string): JalaliDate | null {
  return v ? parseJalali(v) : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toValue(j: JalaliDate): string {
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
}

/** First weekday column (0..6, Saturday = 0) for the 1st of a Jalali month. */
function firstWeekdayColumn(jy: number, jm: number): number {
  const g = toGregorianDate({ jy, jm, jd: 1 });
  return (g.getDay() + 1) % 7;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  maxToday?: boolean;
  className?: string;
};

const YEARS_PER_PAGE = 12;

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "۱۴۰۴/۰۱/۰۱",
  disabled,
  id,
  maxToday,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>("days");
  const [view, setView] = useState<JalaliDate>(() => {
    const parsed = readValue(value);
    return parsed ?? todayJalali();
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => todayJalali(), []);

  // When opening, decide the initial mode from whether a value exists.
  useEffect(() => {
    if (open) setMode("days");
  }, [open]);

  // Keep the calendar view in sync when the value changes externally.
  useEffect(() => {
    const parsed = readValue(value);
    if (parsed) setView({ jy: parsed.jy, jm: parsed.jm, jd: 1 });
  }, [value]);

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

  const selected = readValue(value);
  const displayValue = selected ? formatJalali(selected, { persianDigits: true }) : "";

  const monthLen = monthLength(view.jy, view.jm);
  const startCol = firstWeekdayColumn(view.jy, view.jm);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startCol; i++) cells.push(null);
  for (let d = 1; d <= monthLen; d++) cells.push(d);

  function pickDay(d: number) {
    const j: JalaliDate = { jy: view.jy, jm: view.jm, jd: d };
    if (maxToday && compareJalali(j, today) > 0) return;
    onChange(toValue(j));
    setOpen(false);
  }

  function isDayDisabled(d: number): boolean {
    if (!maxToday) return false;
    return compareJalali({ jy: view.jy, jm: view.jm, jd: d }, today) > 0;
  }

  function isSelectedDay(d: number): boolean {
    return (
      !!selected &&
      selected.jy === view.jy &&
      selected.jm === view.jm &&
      selected.jd === d
    );
  }

  function isToday(d: number): boolean {
    return today.jy === view.jy && today.jm === view.jm && today.jd === d;
  }

  function isSelectedMonth(jm: number): boolean {
    return view.jy === view.jy && view.jm === jm; // current view month
  }

  function prevMonth() {
    setView(addMonths({ ...view, jd: 1 }, -1));
  }
  function nextMonth() {
    setView(addMonths({ ...view, jd: 1 }, 1));
  }

  // The year range shown in years mode (12 years, aligned to a 12-year block).
  const yearBlockStart = Math.floor(view.jy / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  const yearBlockEnd = yearBlockStart + YEARS_PER_PAGE - 1;

  function headerTitle(): string {
    if (mode === "days") return `${MONTH_NAMES[view.jm - 1]} ${toPersianDigits(String(view.jy))}`;
    if (mode === "months") return toPersianDigits(String(view.jy));
    return `${toPersianDigits(String(yearBlockStart))} – ${toPersianDigits(String(yearBlockEnd))}`;
  }

  function onHeaderClick() {
    if (mode === "days") setMode("months");
    else if (mode === "months") setMode("years");
    else setMode("days");
  }

  function onPrev() {
    if (mode === "days") prevMonth();
    else if (mode === "months") setView((v) => ({ ...v, jy: v.jy - 1 }));
    else setView((v) => ({ ...v, jy: v.jy - YEARS_PER_PAGE }));
  }
  function onNext() {
    if (mode === "days") nextMonth();
    else if (mode === "months") setView((v) => ({ ...v, jy: v.jy + 1 }));
    else setView((v) => ({ ...v, jy: v.jy + YEARS_PER_PAGE }));
  }

  function pickMonth(jm: number) {
    setView((v) => ({ ...v, jm }));
    setMode("days");
  }

  function pickYear(jy: number) {
    setView((v) => ({ ...v, jy }));
    setMode("months");
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        readOnly
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onClick={() => !disabled && setOpen((o) => !o)}
        onFocus={() => !disabled && setOpen(true)}
        className={
          className ??
          "w-full cursor-pointer rounded-control border border-border bg-card px-3 py-2 text-left text-sm text-text outline-none transition-colors focus:border-primary disabled:opacity-50"
        }
      />

      {open && (
        <div className="absolute z-40 mt-1 w-72 rounded-card border border-border bg-card p-3 shadow-card">
          {/* Header: prev / title / next */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onPrev}
              className="flex h-8 w-8 items-center justify-center rounded-control border border-border text-text hover:bg-page"
              aria-label="قبلی"
            >
              ›
            </button>
            <button
              type="button"
              onClick={onHeaderClick}
              className="rounded-control px-3 py-1 text-sm font-medium text-text hover:bg-page"
            >
              {headerTitle()}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex h-8 w-8 items-center justify-center rounded-control border border-border text-text hover:bg-page"
              aria-label="بعدی"
            >
              ‹
            </button>
          </div>

          {/* Days view */}
          {mode === "days" && (
            <>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-text-secondary">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e-${i}`} />;
                  const disabledDay = isDayDisabled(d);
                  const selectedDay = isSelectedDay(d);
                  const todayDay = isToday(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabledDay}
                      onClick={() => pickDay(d)}
                      className={`h-8 rounded-control text-sm transition-colors ${
                        selectedDay
                          ? "bg-primary text-white"
                          : todayDay
                            ? "bg-page text-primary"
                            : disabledDay
                              ? "cursor-not-allowed text-disabled"
                              : "text-text hover:bg-page"
                      }`}
                    >
                      {toPersianDigits(String(d))}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Months view */}
          {mode === "months" && (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {MONTH_NAMES.map((name, i) => {
                const jm = i + 1;
                const active = isSelectedMonth(jm);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickMonth(jm)}
                    className={`rounded-control py-2 transition-colors ${
                      active ? "bg-primary text-white" : "text-text hover:bg-page"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Years view */}
          {mode === "years" && (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearBlockStart + i).map(
                (jy) => {
                  const active = jy === view.jy;
                  return (
                    <button
                      key={jy}
                      type="button"
                      onClick={() => pickYear(jy)}
                      className={`rounded-control py-2 transition-colors ${
                        active ? "bg-primary text-white" : "text-text hover:bg-page"
                      }`}
                    >
                      {toPersianDigits(String(jy))}
                    </button>
                  );
                },
              )}
            </div>
          )}

          {/* Footer: today / clear */}
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
              onClick={() => {
                onChange(toValue(today));
                setOpen(false);
              }}
              className="rounded-control px-2 py-1 text-primary hover:bg-page"
            >
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  );
}