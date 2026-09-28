"use client";

import { useState, type ReactNode } from "react";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { PeriodRow } from "@/modules/periods/periods.types";
import { CaseStages } from "./case-stages";

// The five case-page tabs (C-5). The Stages tab hosts the interactive stage
// engine (C-6 / Phase 10 — the strip, current-stage line, the six actions, and
// exceptional stages); the Periods tab renders the `periodsPanel` slot (the period
// cards + the renewal / renewal-follow-up forms, C-9); the Payments tab renders the
// `paymentsPanel` slot and the Tasks tab the `tasksPanel` slot. All three slots are
// composed on the server (C-7 / C-9 / C-11) so this client component never imports
// the periods, payments or followups barrels. History shows a "later phase"
// placeholder so the frame is complete without pretending the data exists yet.

type TabKey = "stages" | "tasks" | "periods" | "payments" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stages", label: "مراحل" },
  { key: "tasks", label: "کارها" },
  { key: "periods", label: "دوره‌ها و تمدید" },
  { key: "payments", label: "پرداخت‌ها" },
  { key: "history", label: "تاریخچه" },
];

const placeholderClass =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

export function CaseTabs({
  current,
  canEdit,
  canAddStage,
  isCancelled,
  periodsPanel,
  paymentsPanel,
  tasksPanel,
}: {
  current: PeriodRow | null;
  canEdit: boolean;
  canAddStage: boolean;
  isCancelled: boolean;
  periodsPanel: ReactNode;
  paymentsPanel: ReactNode;
  tasksPanel: ReactNode;
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
      {active === "periods" && periodsPanel}
      {active === "tasks" && tasksPanel}
      {active === "payments" && paymentsPanel}
      {active === "history" && (
        <div className={placeholderClass}>تاریخچه در فاز بعدی افزوده می‌شود.</div>
      )}
    </div>
  );
}