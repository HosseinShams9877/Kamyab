"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  RefreshCw,
  Package,
  UserCog,
  Settings,
  Cpu,
  BarChart3,
  Bell,
  Megaphone,
  Circle,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string };

const ICON_BY_SEGMENT: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: Users,
  cases: Briefcase,
  tasks: CheckSquare,
  renewals: RefreshCw,
  campaigns: Megaphone,
  services: Package,
  employees: UserCog,
  settings: Settings,
  engine: Cpu,
  reports: BarChart3,
  notifications: Bell,
};

function iconFor(href: string): LucideIcon {
  const segments = href.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const seg = segments[segments.length - 1] ?? "";
  return ICON_BY_SEGMENT[seg] ?? Circle;
}

export function AppShell({
  navItems,
  userName,
  roleLabel,
  logout,
  searchSlot,
  notificationBell,
  children,
}: {
  navItems: NavItem[];
  userName: string;
  roleLabel: string;
  logout: ReactNode;
  searchSlot?: ReactNode;
  notificationBell?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const activeHref = navItems
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="flex min-h-screen bg-page">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-64 max-w-[80vw] flex-col border-e border-border bg-card shadow-sm transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary text-sm font-bold text-white">
            ک
          </div>
          <span className="text-base font-bold text-text">سامانه کامیاب</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = activeHref === item.href;
              const Icon = iconFor(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary hover:bg-page hover:text-text"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-2 end-0 w-1 rounded-s-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex h-16 items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="باز و بسته کردن منو"
              aria-expanded={open}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-page hover:text-text lg:hidden"
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

            <div className="min-w-0 flex-1">{searchSlot}</div>

            {notificationBell && <div className="shrink-0">{notificationBell}</div>}

            <div className="flex items-center gap-3 rounded-control border border-border bg-page/50 px-3 py-1.5">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight text-text">
                  {userName}
                </div>
                <div className="text-xs leading-tight text-text-secondary">
                  {roleLabel}
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {userName.trim().charAt(0) || "?"}
              </div>
            </div>

            <div className="shrink-0">{logout}</div>
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}