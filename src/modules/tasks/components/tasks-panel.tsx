"use client";

import Link from "next/link";
import type {
  TaskRow,
  TaskTab,
  TaskOwnerOption,
  TaskServiceOption,
  TaskListParams,
  StageReminderRow,
} from "../tasks.types";
import { TasksTable } from "./tasks-table";
import { StageRemindersPanel } from "./stage-reminders-panel";

export function TasksPanel({
  tasks,
  stageReminders,
  tab,
  tabs,
  owners,
  services,
  results,
  params,
  basePath = "/tasks",
  showOwnerFilter = true,
}: {
  tasks: TaskRow[];
  stageReminders: StageReminderRow[];
  tab: TaskTab;
  tabs: { key: TaskTab; label: string }[];
  owners: TaskOwnerOption[];
  services: TaskServiceOption[];
  results: { id: string; title: string }[];
  params: TaskListParams;
  basePath?: string;
  showOwnerFilter?: boolean;
}) {
  return (
    <div>
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

      {tab === "reminders" ? (
        <StageRemindersPanel rows={stageReminders} basePath={basePath} />
      ) : (
        <TasksTable
          items={tasks}
          params={params}
          owners={owners}
          services={services}
          results={results}
          basePath={basePath}
          currentTab={tab}
          showOwnerFilter={showOwnerFilter}
        />
      )}
    </div>
  );
}