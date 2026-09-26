"use client";

import { useState } from "react";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { PeriodRow } from "@/modules/periods/periods.types";
import {
  STAGE_STATUS_LABELS,
  STAGE_STATUS_BADGE,
  PERIOD_STATUS_LABELS,
} from "@/modules/periods/lib/labels";

// The five case-page tabs (C-5). Phase 9 is a read-only shell: the Stages tab
// lists the current period's copied stages with their status (the six stage
// ACTIONS arrive with the stage engine, C-6 / Phase 10); the Periods tab lists
// every validity span; Tasks, Payments, and History show a "later phase"
// placeholder so the frame is complete without pretending the data exists yet.

type TabKey = "stages" | "tasks" | "periods" | "payments" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stages", label: "مراحل" },
  { key: "tasks", label: "کارها" },
  { key: "periods", label: "دوره‌ها و تمدید" },
  { key: "payments", label: "پرداخت‌ها" },
  { key: "history", label: "تاریخچه" },
];

const badgeClass = "rounded-badge px-2.5 py-0.5 text-xs";
const placeholderClass =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

export function CaseTabs({
  current,
  periods,
}: {
  current: PeriodRow | null;
  periods: PeriodRow[];
}) {
  const [active, setActive] = useState<TabKey>("stages");

  return (
    <div>
      {/* Tab bar: scrolls horizontally on narrow screens, ≥44px touch targets. */}
      <div
        role="tablist"
        className="mb-4 flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={`min-h-[44px] whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === "stages" && <StagesPanel current={current} />}
      {active === "periods" && <PeriodsPanel periods={periods} />}
      {active === "tasks" && (
        <div className={placeholderClass}>کارها در فاز بعدی افزوده می‌شود.</div>
      )}
      {active === "payments" && (
        <div className={placeholderClass}>
          پرداخت‌ها در فاز بعدی افزوده می‌شود.
        </div>
      )}
      {active === "history" && (
        <div className={placeholderClass}>تاریخچه در فاز بعدی افزوده می‌شود.</div>
      )}
    </div>
  );
}
// HELPERS_PLACEHOLDER

// Stages tab: the current period's copied stages, read-only. Ordered by the
// path order; a stage flagged exceptional carries a small caption.
function StagesPanel({ current }: { current: PeriodRow | null }) {
  if (!current || current.stages.length === 0) {
    return (
      <div className={placeholderClass}>
        برای این پرونده مرحله‌ای تعریف نشده است.
      </div>
    );
  }
  const stages = [...current.stages].sort((a, b) => a.order - b.order);
  return (
    <ul className="space-y-2">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {toPersianDigits(String(stage.order))}.
            </span>
            <span className="text-sm text-text">{stage.title}</span>
            {stage.isExceptional && (
              <span className={`${badgeClass} bg-info-bg text-info`}>
                استثنائی
              </span>
            )}
          </div>
          <span className={`${badgeClass} ${STAGE_STATUS_BADGE[stage.status]}`}>
            {STAGE_STATUS_LABELS[stage.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Periods tab: every validity span of the case, newest concerns first left as
// natural (indexNumber) order. Financial figures are read-time computed (rule 2).
function PeriodsPanel({ periods }: { periods: PeriodRow[] }) {
  if (periods.length === 0) {
    return <div className={placeholderClass}>دوره‌ای ثبت نشده است.</div>;
  }
  return (
    <ul className="space-y-2">
      {periods.map((period) => (
        <li
          key={period.id}
          className="rounded-card border border-border bg-card p-4 shadow-card"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text">
              {period.indexNumber <= 1
                ? "دورهٔ ثبت اولیه"
                : `دورهٔ ${toPersianDigits(String(period.indexNumber))}`}
            </span>
            <span className={`${badgeClass} bg-page text-text-secondary`}>
              {PERIOD_STATUS_LABELS[period.status]}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-text-secondary">تاریخ شروع</dt>
              <dd className="text-text">{toPersianDigits(period.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">تاریخ انقضا</dt>
              <dd className="text-text">
                {period.expiryDate ? toPersianDigits(period.expiryDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">مبلغ کل</dt>
              <dd className="text-text">
                {period.totalAmount === null
                  ? "—"
                  : formatToman(period.totalAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">مانده</dt>
              <dd className="text-text">
                {period.balance === null ? "—" : formatToman(period.balance)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
