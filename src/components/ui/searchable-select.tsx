"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

// A searchable single-select. Behaves like a <select> but with a filter input
// at the top of the dropdown. Client component; the parent owns the value.
//
// `numericDisplay`: when true, the query field renders Persian digits and
// stores ASCII — for selects whose options are numeric (case numbers, IDs).
// When false (default) the query is a normal RTL text field.

export type SearchableOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string; // shown as the first option (empty value)
  disabled?: boolean;
  /** Normalize the query before matching (e.g. Persian → English digits). */
  normalizeQuery?: (q: string) => string;
  /** Show the query input with Persian digits + LTR layout. */
  numericDisplay?: boolean;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "انتخاب کنید…",
  emptyLabel,
  disabled,
  normalizeQuery,
  numericDisplay = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const norm = normalizeQuery ?? ((q: string) => q.trim());
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q));
  }, [options, query, normalizeQuery]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset highlight when the filtered list changes.
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight].value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-card px-3 py-2 text-right text-sm text-text outline-none transition-colors focus:border-primary disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "text-text" : "text-text-secondary"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-text-secondary">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-card border border-border bg-card shadow-card">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              type="text"
              dir={numericDisplay ? "ltr" : "rtl"}
              value={numericDisplay ? toPersianDigits(query) : query}
              onChange={(e) =>
                setQuery(
                  numericDisplay
                    ? toEnglishDigits(e.target.value)
                    : e.target.value,
                )
              }
              onKeyDown={onKeyDown}
              placeholder="جستجو…"
              className={`w-full rounded-control border border-border bg-page px-2 py-1.5 text-sm text-text outline-none focus:border-primary ${
                numericDisplay ? "text-left" : ""
              }`}
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {emptyLabel && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`w-full rounded-control px-3 py-2 text-right text-sm ${
                    value === ""
                      ? "bg-page text-text"
                      : "text-text-secondary hover:bg-page"
                  }`}
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full rounded-control px-3 py-2 text-right text-sm ${
                    o.value === value
                      ? "bg-page text-primary"
                      : i === highlight
                        ? "bg-page text-text"
                        : "text-text hover:bg-page"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-center text-sm text-text-secondary">
                موردی یافت نشد.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}