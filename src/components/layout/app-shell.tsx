"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared application shell: a persistent sidebar + top bar around the page
// content, used by both the manager and employee route groups. This component
// is purely presentational (rule 10 — shared UI carries no domain logic):
// authorization and permission-based link filtering happen server-side in each
// route-group layout, which passes an already-filtered `navItems` list and a
// ready-made `logout` control down as props. Keeping domain code out means the
// shell never imports a module barrel, so no server-only code leaks into the
// client bundle.
//
// The app is always RTL, so the sidebar sits at the start (right) edge. On
// desktop it is a static column; on mobile it collapses into an off-canvas
// drawer toggled by the hamburger button and dismissed by a backdrop.

export type NavItem = { href: string; label: string };

export function AppShell({
  navItems,
  userName,
  roleLabel,
  logout,
  searchSlot,
  children,
}: {
  navItems: NavItem[];
  userName: string;
  roleLabel: string;
  logout: React.ReactNode;
  searchSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex min-h-screen bg-page">
      {/* Backdrop — mobile only, shown while the drawer is open. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile (anchored to the right and
          sliding off to the right), static column from lg up. */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-64 max-w-[80vw] flex-col border-e border-border bg-card transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <span className="text-lg font-bold text-primary">سامانه کامیاب</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center rounded-control px-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "text-text hover:bg-page"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main column: top bar + content. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card px-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="باز و بسته کردن منو"
            aria-expanded={open}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text transition-colors hover:bg-page lg:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Global-search slot (C-16). The route-group layout passes the
              search box in; it falls back to nothing if a layout omits it. */}
          <div className="min-w-0 flex-1">{searchSlot}</div>

          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-text">{userName}</div>
            <div className="text-xs text-text-secondary">{roleLabel}</div>
          </div>
          <div className="shrink-0">{logout}</div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
