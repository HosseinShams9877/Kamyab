"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
// Isomorphic types leaf only — a client component never imports the module
// barrel (it aggregates server-only Prisma access). C-16.
import { SEARCH_MIN_LENGTH, type SearchResults } from "../search.types";

// Global search box (C-16), mounted in the app shell's top bar. Debounces the
// query, fetches categorized results from /api/search (which authorizes and
// owner-scopes server-side), and shows them in a dropdown. Cancelled cases and
// deactivated customers still appear, each with a status badge. Detail links
// point at the shared /cases/[id] and /customers/[id] routes, which guard by
// ownership so both a manager and the owning employee can follow them.

const DEBOUNCE_MS = 250;
const EMPTY: SearchResults = { customers: [], cases: [] };

// Presentation-only badge tones keyed by raw case status. Kept inline rather
// than imported from the cases module so this client leaf stays decoupled from
// a server barrel (mirrors CASE_STATUS_BADGE in cases/lib/labels.ts).
const CASE_BADGE: Record<string, string> = {
  NEW: "bg-info-bg text-info",
  IN_PROGRESS: "bg-warning-bg text-warning",
  COMPLETED: "bg-success-bg text-success",
  CANCELLED: "bg-disabled-bg text-disabled",
};

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const active = q.length >= SEARCH_MIN_LENGTH;

  // Debounced fetch: each keystroke cancels the previous timer and any in-flight
  // request; below the minimum length we clear results without hitting the API.
  useEffect(() => {
    if (!active) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        setResults((await res.json()) as SearchResults);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, active]);

  // Dismiss the dropdown on an outside click or the Escape key.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const hasResults = results.customers.length > 0 || results.cases.length > 0;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="جستجو…"
        aria-label="جستجوی سراسری"
        className="h-10 w-full max-w-md rounded-control border border-border bg-page px-3 text-sm text-text outline-none transition-colors placeholder:text-text-secondary focus:border-primary"
      />

      {open && active && (
        <div className="absolute z-50 mt-1 max-h-[70vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-card shadow-card">
          {loading && !hasResults && (
            <p className="px-4 py-3 text-sm text-text-secondary">در حال جستجو…</p>
          )}

          {!loading && !hasResults && (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">موردی یافت نشد</p>
          )}

          {results.customers.length > 0 && (
            <div className="border-b border-border py-1">
              <p className="px-4 py-2 text-xs font-medium text-text-secondary">مشتریان</p>
              <ul>
                {results.customers.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/customers/${c.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm hover:bg-page"
                    >
                      <span className="min-w-0 flex-1 truncate text-text">{c.displayName}</span>
                      {!c.active && (
                        <span className="shrink-0 rounded-control bg-disabled-bg px-2 py-0.5 text-xs text-disabled">
                          غیرفعال
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-text-secondary" dir="ltr">
                        {toPersianDigits(c.mobile)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.cases.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-2 text-xs font-medium text-text-secondary">پرونده‌ها</p>
              <ul>
                {results.cases.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/cases/${c.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm hover:bg-page"
                    >
                      <span className="shrink-0 font-medium text-text" dir="ltr">
                        {toPersianDigits(c.number)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-text-secondary">
                        {c.customerName} · {c.serviceName}
                      </span>
                      <span
                        className={`shrink-0 rounded-control px-2 py-0.5 text-xs ${
                          CASE_BADGE[c.status] ?? "bg-disabled-bg text-disabled"
                        }`}
                      >
                        {c.statusLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
