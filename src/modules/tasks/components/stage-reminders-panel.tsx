"use client";

import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import type { StageReminderRow } from "../tasks.types";

// Read-only panel for the "یادآوری‌ها" tab. Shows every open stage with a due
// date (from CaseStage.dueDate), with a live "days remaining" badge. Nothing
// here writes; the engine is the only writer of StageReminderLog.

const badgeClass = "rounded-badge px-2.5 py-0.5 text-xs whitespace-nowrap";

export function StageRemindersPanel({
  rows,
  basePath = "/tasks",
}: {
  rows: StageReminderRow[];
  basePath?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-b-card border border-t-0 border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
        یادآوری‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  // Strip a trailing "/tasks" so the case link points at the right shell
  // (managers: "/cases/...", employees: "/employee/cases/...").
  const caseBase = basePath.replace(/\/tasks$/, "");

  return (
    <div className="overflow-hidden rounded-b-card border border-t-0 border-border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">مرحله</th>
              <th className="px-4 py-3 font-medium">پرونده</th>
              <th className="px-4 py-3 font-medium">مشتری</th>
              <th className="px-4 py-3 font-medium">خدمت</th>
              <th className="px-4 py-3 font-medium">مسئول</th>
              <th className="px-4 py-3 font-medium">سررسید</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stageId} className="border-t border-border">
                <td className="px-4 py-3 text-text break-words font-medium">
                  {r.stageTitle}
                </td>
                <td className="px-4 py-3 text-text" dir="ltr">
                  {toPersianDigits(r.caseNumber)}
                </td>
                <td className="px-4 py-3 text-text-secondary break-words">
                  {r.customerName}
                </td>
                <td className="px-4 py-3 text-text-secondary">{r.serviceName}</td>
                <td className="px-4 py-3 text-text-secondary">{r.ownerName}</td>
                <td className="px-4 py-3 text-text" dir="ltr">
                  {r.dueDate ? toPersianDigits(r.dueDate) : "—"}
                </td>
                <td className="px-4 py-3">
                  {r.isPast ? (
                    <span className={`${badgeClass} bg-error-bg text-error`}>
                      {toPersianDigits(String(Math.abs(r.daysRemaining ?? 0)))} روز گذشته
                    </span>
                  ) : r.isToday ? (
                    <span className={`${badgeClass} bg-warning-bg text-warning`}>
                      امروز
                    </span>
                  ) : (
                    <span className={`${badgeClass} bg-info-bg text-info`}>
                      {toPersianDigits(String(r.daysRemaining ?? 0))} روز مانده
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`${caseBase}/cases/${r.caseId}`}
                    className="inline-flex min-h-[36px] items-center rounded-control border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-page"
                  >
                    پرونده
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}