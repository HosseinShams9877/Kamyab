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
  emptyLabel?: string;
  disabled?: boolean;
  normalizeQuery?: (q: string) => string;
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
      {/* Trigger button — clearly a control: bordered, tinted background, hover glow. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-control border px-3 py-2 text-right text-sm outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          open
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border bg-page/50 hover:border-primary/50 hover:bg-primary/10"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "text-text font-medium" : "text-text-secondary"}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron icon, rotates when open. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-primary" : "text-text-secondary"
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-card border border-primary/30 bg-card shadow-card">
          {/* Search input with a magnifier icon, on a subtly tinted strip. */}
          <div className="border-b border-primary/20 bg-primary/5 p-2">
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-primary"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
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
                className={`w-full rounded-control border border-border bg-card py-1.5 pr-8 pl-2 text-sm text-text outline-none transition-colors focus:border-primary ${
                  numericDisplay ? "text-left pl-8 pr-2" : ""
                }`}
              />
            </div>
          </div>

          {/* Options list. */}
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {emptyLabel && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-right text-sm transition-colors ${
                    value === ""
                      ? "bg-primary/20 font-medium text-primary"
                      : "text-text-secondary hover:bg-primary/15 hover:text-primary"
                  }`}
                >
                  <span>{emptyLabel}</span>
                  {value === "" && <CheckIcon />}
                </button>
              </li>
            )}

            {filtered.map((o, i) => {
              const isSelected = o.value === value;
              const isHighlighted = i === highlight;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => pick(o.value)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-right text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/20 font-medium text-primary"
                        : isHighlighted
                          ? "bg-primary/15 text-primary"
                          : "text-text hover:bg-primary/15 hover:text-primary"
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && <CheckIcon />}
                  </button>
                </li>
              );
            })}

            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-text-secondary">
                موردی یافت نشد.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A small tick shown next to the selected option. */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}