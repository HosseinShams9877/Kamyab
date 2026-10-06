"use client";

import { useState, type ReactNode } from "react";
import type { PeriodRow } from "@/modules/periods/periods.types";
import type { StageSettings } from "../cases.types";
import { CaseStages } from "./case-stages";

type TabKey =
  | "stages"
  | "tasks"
  | "periods"
  | "payments"
  | "history"
  | "stageSettings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stages", label: "مراحل" },
  { key: "tasks", label: "کارها" },
  { key: "periods", label: "دوره‌ها و تمدید" },
  { key: "payments", label: "پرداخت‌ها" },
  { key: "history", label: "تاریخچه" },
  { key: "stageSettings", label: "تنظیمات مراحل" },
];

const placeholderClass =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

export function CaseTabs({
  current,
  canEdit,
  canAddStage,
  canCreateTask,
  isCancelled,
  periodsPanel,
  paymentsPanel,
  tasksPanel,
  taskForm,
  stageSettingsPanel,
  stageSettings,
}: {
  current: PeriodRow | null;
  canEdit: boolean;
  canAddStage: boolean;
  canCreateTask: boolean;
  isCancelled: boolean;
  periodsPanel: ReactNode;
  paymentsPanel: ReactNode;
  tasksPanel: ReactNode;
  taskForm: ReactNode;
  stageSettingsPanel: ReactNode;
  stageSettings: StageSettings;
}) {
  const [active, setActive] = useState<TabKey>("stages");
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  return (
    <div>
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
          stageSettings={stageSettings}
        />
      )}

      {active === "tasks" && (
        <div className="space-y-4">
          {canCreateTask && !taskFormOpen && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setTaskFormOpen(true)}
                className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                + کار جدید
              </button>
            </div>
          )}

          {taskFormOpen && (
            <section className="rounded-card border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-text">ثبت کار جدید</h2>
                <button
                  type="button"
                  onClick={() => setTaskFormOpen(false)}
                  className="text-sm text-text-secondary hover:text-text"
                >
                  بستن
                </button>
              </div>
              {taskForm}
            </section>
          )}

          {tasksPanel}
        </div>
      )}

      {active === "periods" && periodsPanel}
      {active === "payments" && paymentsPanel}
      {active === "history" && (
        <div className={placeholderClass}>تاریخچه در فاز بعدی افزوده می‌شود.</div>
      )}
      {active === "stageSettings" && stageSettingsPanel}
    </div>
  );
}