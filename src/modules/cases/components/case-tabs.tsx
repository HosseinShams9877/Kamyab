"use client";

import { useState, type ReactNode } from "react";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { PeriodRow } from "@/modules/periods/periods.types";
import { CaseStages } from "./case-stages";

// The five case-page tabs (C-5). Stages hosts the stage engine; Tasks hosts the
// follow-up timeline **and the task-create form behind a button**; Periods hosts
// the period cards + renewal; Payments hosts the financial panel; History is a
// later-phase placeholder.
//
// ## Why the task form lives inside the Tasks tab
//
// Creating a task is an action on the case, and the Tasks tab is where the case's
// tasks are shown. The button that opens the form sits at the start of that
// panel — the reading edge in RTL — where the thing it acts on is already on
// screen. A separate tab (or a dialog, or a route transition) would move the user
// away from the list they are adding to, and would be a second place a form has
// to stay in sync with this one.
//
// The form itself is composed on the server (`taskForm` prop) rather than fetched
// here, so this component stays a client shell and never imports the tasks
// module's runtime. A user without `tasks.create` never receives the slot, so an
// empty panel cannot appear for a user who cannot use it.
//
// ## The presets
//
// The slot is composed on the server with this case's id and its customer's id,
// so the form opens with the case already picked. Both fields stay editable — the
// form's contract is "these are the values we start from" — and the API re-checks
// the permission and the tenant scope regardless (rule 3). Nothing about the case
// is passed through the button: the presets are the server's, not the click's.

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
  canCreateTask,
  isCancelled,
  periodsPanel,
  paymentsPanel,
  tasksPanel,
  taskForm,
}: {
  current: PeriodRow | null;
  canEdit: boolean;
  canAddStage: boolean;
  canCreateTask: boolean;
  isCancelled: boolean;
  periodsPanel: ReactNode;
  paymentsPanel: ReactNode;
  tasksPanel: ReactNode;
  /** The task-create form, composed on the server with this case's presets. */
  taskForm: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("stages");
  // The form is closed until the user asks for it, so the tab opens on the list
  // — which is what the user came for — rather than on an empty form.
  const [taskFormOpen, setTaskFormOpen] = useState(false);

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

      {active === "tasks" && (
        <div className="space-y-4">
          {/* The action sits at the reading edge of the panel it acts on. In RTL
              that is the right side, which is `justify-start` — `justify-end`
              would push it to the left, which is the trailing edge here. The
              permission gates the button here and the slot on the server, so a
              user without `tasks.create` sees neither. */}
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
    </div>
  );
}