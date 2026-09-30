"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (client-component exception): never a module barrel.
import { recordResultSchema } from "../followups.schema";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { toEnglishDigits } from "@/lib/digits";

// The record-result dialog (C-11 / B-6): modal overlay opened from the tasks
// table. Collects the result + optional note + optional "next task" (title +
// due date), then POSTs to /api/tasks/[id]/result. The server runs the whole
// thing as one transaction (close task, write follow-up, apply the effect on
// the active period, optionally create the next task). Server re-checks authz.

const field =
  "w-full rounded-control border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-text placeholder:text-text-secondary outline-none transition-colors focus:border-primary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const labelCls = "mb-2 block text-sm font-medium text-text";

function Req() {
  return <span className="text-error"> *</span>;
}

type Props = {
  taskId: string;
  taskTitle: string;
  results: { id: string; title: string }[];
  onClose: () => void;
  onSuccess: () => void;
};

export function RecordResultDialog({
  taskId,
  taskTitle,
  results,
  onClose,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resultId, setResultId] = useState(results[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [nextTask, setNextTask] = useState(false);
  const [nextTitle, setNextTitle] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");

  const working = busy || pending;

  async function submit() {
    setError(null);

    const parsed = recordResultSchema.safeParse({
      resultId,
      note,
      nextTask,
      nextTaskTitle: nextTitle,
      nextTaskDueDate: nextDueDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "ثبت نتیجه انجام نشد.");
        return;
      }
      onSuccess();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg rounded-card border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-bold text-text">ثبت نتیجه پیگیری</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-page"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {error && (
            <p className="rounded-control bg-error-bg px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <div>
            <label className={labelCls}>
              نتیجه
              <Req />
            </label>
            <SearchableSelect
              value={resultId}
              onChange={setResultId}
              options={results.map((r) => ({ value: r.id, label: r.title }))}
              placeholder="— انتخاب نتیجه —"
              normalizeQuery={toEnglishDigits}
            />
          </div>

          <div>
            <label className={labelCls}>توضیحات</label>
            <textarea
              rows={4}
              maxLength={500}
              dir="rtl"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={working}
              className={`${field} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={nextTask}
              onChange={(e) => setNextTask(e.target.checked)}
              disabled={working}
              className="h-4 w-4"
            />
            ساخت کار بعدی
          </label>

          {nextTask && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>عنوان کار بعدی</label>
                <input
                  type="text"
                  maxLength={150}
                  dir="rtl"
                  placeholder={taskTitle}
                  value={nextTitle}
                  onChange={(e) => setNextTitle(e.target.value)}
                  disabled={working}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls}>
                  تاریخ سررسید کار بعدی
                  <Req />
                </label>
                <JalaliDatePicker
                  value={nextDueDate}
                  onChange={setNextDueDate}
                  placeholder="۱۴۰۵/۰۷/۰۱"
                />
              </div>
            </div>
          )}

          <div className="rounded-control bg-info-bg px-4 py-3 text-xs leading-relaxed text-info">
            نتایج مرتبط با تمدید (موافق یا مخالف تمدید) وضعیت پیگیری تمدید پرونده را هم به‌روزرسانی می‌کنند.
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className={ghostBtn}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={working || !resultId || (nextTask && !nextDueDate.trim())}
            className={primaryBtn}
          >
            {working ? "در حال ثبت…" : "ثبت نتیجه"}
          </button>
        </div>
      </div>
    </div>
  );
}