"use client";

import { useState } from "react";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { PeriodRow } from "@/modules/periods/periods.types";
import { PERIOD_STATUS_LABELS } from "@/modules/periods/lib/labels";
import { CaseStages } from "./case-stages";

// The five case-page tabs (C-5). The Stages tab hosts the interactive stage
// engine (C-6 / Phase 10 — the strip, current-stage line, the six actions, and
// exceptional stages); the Periods tab lists every validity span; Tasks,
// Payments, and History show a "later phase" placeholder so the frame is
// complete without pretending the data exists yet.

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
  canEdit,
  canAddStage,
  isCancelled,
}: {
  current: PeriodRow | null;
  periods: PeriodRow[];
  canEdit: boolean;
  canAddStage: boolean;
  isCancelled: boolean;
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

      {active === "stages" && (
        <CaseStages
          stages={current?.stages ?? []}
          periodId={current?.id ?? null}
          canEdit={canEdit}
          canAddStage={canAddStage}
          isCancelled={isCancelled}
        />
      )}
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
