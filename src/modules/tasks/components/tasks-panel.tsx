"use client";

import Link from "next/link";
// Isomorphic leaf imports (client-component exception): never a module barrel.
import type {
  TaskRow,
  TaskTab,
  TaskOwnerOption,
  TaskServiceOption,
  TaskListParams,
} from "../tasks.types";
import { TasksTable } from "./tasks-table";

// The interactive tasks page body (C-11): the seven-tab navigation and the
// filterable table. The create form lives on its own page (/tasks/new), linked
// from the page header's "+ ثبت کار جدید" button — this panel only lists and
// filters. Client leaf: imports isomorphic leaves; the table is server-rendered
// with a GET-form filter bar.

export function TasksPanel({
  tasks,
  tab,
  tabs,
  owners,
  services,
  params,
  basePath = "/tasks",
}: {
  tasks: TaskRow[];
  tab: TaskTab;
  tabs: { key: TaskTab; label: string }[];
  owners: TaskOwnerOption[];
  services: TaskServiceOption[];
  params: TaskListParams;
  basePath?: string;
}) {
  return (
    <div>
      {/* Tabs */}
            {/* Tabs */}
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`${basePath}?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Table + filter */}
      <TasksTable
        items={tasks}
        params={params}
        owners={owners}
        services={services}
        basePath={basePath}
        currentTab={tab}
      />
    </div>
  );
}