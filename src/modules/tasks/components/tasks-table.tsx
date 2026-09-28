"use client";

import { useState } from "react";
import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
} from "../lib/labels";
import type {
  TaskRow,
  TaskListParams,
  TaskOwnerOption,
  TaskServiceOption,
} from "../tasks.types";
import { RecordResultDialog } from "@/modules/followups/components/record-result-dialog";

type Props = {
  items: TaskRow[];
  params: TaskListParams;
  owners: TaskOwnerOption[];
  services: TaskServiceOption[];
  results: { id: string; title: string }[];
  basePath: string;
  currentTab: string;
  showOwnerFilter?: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

const PRIORITY_VALUES = ["NORMAL", "HIGH", "URGENT"] as const;

export function TasksTable({
  items,
  params,
  owners,
  services,
  results,
  basePath,
  currentTab,
  showOwnerFilter = true,
}: Props) {
  const [recording, setRecording] = useState<TaskRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-b-card border border-t-0 border-border bg-card shadow-card">
        <form
          method="get"
          action={basePath}
          className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input type="hidden" name="tab" value={currentTab} />
          <div className="sm:col-span-2">
            <input
              name="q"
              type="text"
              defaultValue={params.q ?? ""}
              placeholder="عنوان کار، مشتری، پرونده، خدمت یا مسئول…"
              className={inputClass}
            />
          </div>
          {showOwnerFilter && (
            <div>
              <select name="ownerId" defaultValue={params.ownerId ?? ""} className={inputClass}>
                <option value="">مسئول</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.fullName}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <select name="serviceId" defaultValue={params.serviceId ?? ""} className={inputClass}>
              <option value="">خدمت</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select name="priority" defaultValue={params.priority ?? ""} className={inputClass}>
              <option value="">اولویت</option>
              {PRIORITY_VALUES.map((p) => (
                <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-5 lg:justify-end">
            <button
              type="submit"
              className="min-h-[44px] rounded-control bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
            >
              اعمال فیلتر
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">عنوان کار</th>
                <th className="px-4 py-3 font-medium">مشتری / پرونده</th>
                <th className="px-4 py-3 font-medium">خدمت</th>
                <th className="px-4 py-3 font-medium">مسئول</th>
                <th className="px-4 py-3 font-medium">موعد</th>
                <th className="px-4 py-3 font-medium">اولویت</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text break-words font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {t.caseNumber ? (
                      <span dir="ltr" className="text-text">
                        {toPersianDigits(t.caseNumber)}
                      </span>
                    ) : null}
                    {t.customerName ? (
                      <div className={t.caseNumber ? "mt-1 text-xs text-text-secondary" : "text-text"}>
                        {t.customerName}
                      </div>
                    ) : null}
                    {!t.caseNumber && !t.customerName && "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{t.serviceName ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{t.ownerName}</td>
                  <td className="px-4 py-3 text-text-secondary" dir="ltr">
                    {toPersianDigits(t.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-badge px-2.5 py-0.5 text-xs ${TASK_PRIORITY_BADGE[t.priority]}`}>
                      {TASK_PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.overdue ? (
                      <span className="rounded-badge bg-error-bg px-2.5 py-0.5 text-xs text-error">
                        عقب‌افتاده
                      </span>
                    ) : (
                      <span className="rounded-badge bg-success-bg px-2.5 py-0.5 text-xs text-success">
                        {TASK_STATUS_LABELS[t.status]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setRecording(t)}
                      disabled={t.status !== "OPEN" || !t.caseId}
                      title={
                        t.status !== "OPEN"
                          ? "این کار قبلاً بسته شده"
                          : !t.caseId
                            ? "ثبت نتیجه فقط برای کارهای متصل به پرونده ممکن است"
                            : undefined
                      }
                      className="inline-flex min-h-[36px] items-center rounded-control border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ثبت نتیجه
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    کاری در این نما وجود ندارد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {recording && (
        <RecordResultDialog
          taskId={recording.id}
          taskTitle={recording.title}
          results={results}
          onClose={() => setRecording(null)}
          onSuccess={() => setRecording(null)}
        />
      )}
    </>
  );
}