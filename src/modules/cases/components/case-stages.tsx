"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import type { StageRow } from "@/modules/periods/periods.types";
import {
  STAGE_STATUS_LABELS,
  STAGE_STATUS_BADGE,
} from "@/modules/periods/lib/labels";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import type { StageSettings } from "../cases.types";

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "REJECTED"];
const badge = "rounded-badge px-2 py-0.5 text-xs whitespace-nowrap";
const btn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary =
  "min-h-[36px] rounded-control bg-primary px-3 text-xs text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

type NoteEditor = { stageId: string; op: "reject" | "note"; value: string } | null;

export function CaseStages({
  stages,
  periodId,
  canEdit,
  canAddStage,
  isCancelled,
  stageSettings,
}: {
  stages: StageRow[];
  periodId: string | null;
  canEdit: boolean;
  canAddStage: boolean;
  isCancelled: boolean;
  stageSettings: StageSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<NoteEditor>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dueDialog, setDueDialog] = useState<{
    stageId: string;
    value: string;
  } | null>(null);
  const [pendingAutoPrompt, setPendingAutoPrompt] = useState<string | null>(null);

  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const currentId = ordered.find((s) => OPEN_STATUSES.includes(s.status))?.id ?? null;
  const current = ordered.find((s) => s.id === currentId) ?? null;
  const passed = ordered.filter(
    (s) => s.status === "DONE" || s.status === "NOT_NEEDED",
  ).length;
  const total = ordered.length;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  const working = busy || pending;

  async function call(method: string, url: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "خطا در انجام عملیات.");
        return;
      }
      setEditor(null);
      setNewTitle("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const action = async (stageId: string, op: string, note?: string) => {
    await call("POST", `/api/cases/stages/${stageId}`, { op, note });
    if (op === "done" && stageSettings.autoPrompt) {
      const currentOrder = ordered.find((s) => s.id === stageId)?.order ?? -1;
      const next = ordered.find(
        (s) => s.order > currentOrder && OPEN_STATUSES.includes(s.status),
      );
      if (next) {
        setPendingAutoPrompt(next.id);
        setDueDialog({ stageId: next.id, value: next.dueDate ?? "" });
      }
    }
  };

  const move = (stageId: string, op: "move_up" | "move_down") =>
    call("PATCH", `/api/cases/stages/${stageId}`, { op });
  const remove = (stageId: string) =>
    call("DELETE", `/api/cases/stages/${stageId}`);
  const add = () => {
    if (!periodId || !newTitle.trim()) return;
    call("POST", "/api/cases/stages", { periodId, title: newTitle.trim() });
  };

  async function saveDue(stageId: string, value: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/stages/${stageId}/due-date`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: value }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? "ثبت سررسید انجام نشد.");
        return;
      }
      setDueDialog(null);
      setPendingAutoPrompt(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  function circleClass(status: string, isCurrent: boolean): string {
    const ring = isCurrent ? " ring-4 ring-primary/30" : "";
    switch (status) {
      case "DONE":
        return "bg-success text-white" + ring;
      case "REJECTED":
        return "bg-error text-white" + ring;
      case "NOT_NEEDED":
        return "bg-disabled-bg text-text-secondary" + ring;
      case "IN_PROGRESS":
        return "bg-primary text-white" + ring;
      default:
        return "bg-page text-text-secondary border border-border" + ring;
    }
  }

  function connectorClass(status: string): string {
    return status === "DONE" || status === "NOT_NEEDED"
      ? "bg-success"
      : status === "REJECTED"
        ? "bg-error"
        : "bg-border";
  }

  function renderActions(s: StageRow) {
    const isOpen = OPEN_STATUSES.includes(s.status);
    const disabled = working || isCancelled;
    const acts = canEdit
      ? [
          {
            key: "start",
            label: "شروع",
            show: s.status === "PENDING",
            on: () => action(s.id, "start"),
          },
          {
            key: "done",
            label: "اتمام",
            show: isOpen,
            on: () => action(s.id, "done"),
          },
          {
            key: "reject",
            label: "رد",
            show: isOpen,
            on: () => setEditor({ stageId: s.id, op: "reject", value: "" }),
          },
          {
            key: "not_needed",
            label: "نیازی نیست",
            show: isOpen,
            on: () => action(s.id, "not_needed"),
          },
          {
            key: "reopen",
            label: "بازگشایی",
            show: !isOpen,
            on: () => action(s.id, "reopen"),
          },
          {
            key: "note",
            label: "یادداشت",
            show: true,
            on: () =>
              setEditor({ stageId: s.id, op: "note", value: s.note ?? "" }),
          },
        ]
      : [];
    const canMove = canAddStage && s.isExceptional;
    const canDelete = canMove && s.status === "PENDING" && s.attemptCount === 0;
    const visible = acts.filter((a) => a.show);
    const hasDueButton = canEdit;
    if (
      visible.length === 0 &&
      !canMove &&
      !canDelete &&
      !hasDueButton &&
      editor?.stageId !== s.id
    ) {
      return null;
    }
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {visible.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.on}
              disabled={disabled}
              className={a.key === "done" ? btnPrimary : btn}
            >
              {a.label}
            </button>
          ))}
          {canEdit && (
            <button
              type="button"
              onClick={() => setDueDialog({ stageId: s.id, value: s.dueDate ?? "" })}
              disabled={disabled}
              className={btn}
            >
              {s.dueDate ? "ویرایش سررسید" : "تعیین سررسید"}
            </button>
          )}
          {canMove && (
            <>
              <button
                type="button"
                onClick={() => move(s.id, "move_up")}
                disabled={disabled}
                className={btn}
                aria-label="انتقال به بالا"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(s.id, "move_down")}
                disabled={disabled}
                className={btn}
                aria-label="انتقال به پایین"
              >
                ▼
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => remove(s.id)}
              disabled={disabled}
              className={`${btn} text-error hover:bg-error-bg`}
            >
              حذف
            </button>
          )}
        </div>
        {editor?.stageId === s.id && renderEditor(s)}
      </div>
    );
  }

  function renderEditor(s: StageRow) {
    if (!editor || editor.stageId !== s.id) return null;
    const isReject = editor.op === "reject";
    return (
      <div className="mt-2">
        <textarea
          value={editor.value}
          onChange={(e) => setEditor({ ...editor, value: e.target.value })}
          rows={2}
          maxLength={1000}
          dir="rtl"
          placeholder={isReject ? "دلیل رد (الزامی)" : "یادداشت مرحله"}
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-secondary"
        />
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => action(s.id, editor.op, editor.value)}
            disabled={working || (isReject && !editor.value.trim())}
            className={btnPrimary}
          >
            ثبت
          </button>
          <button
            type="button"
            onClick={() => setEditor(null)}
            disabled={working}
            className={btn}
          >
            انصراف
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ordered.length > 0 && (
        <>
          <div className="overflow-x-auto py-4">
            <div className="flex min-w-min items-center gap-2 px-2">
              {ordered.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    title={s.title}
                    aria-label={s.title}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all ${circleClass(
                      s.status,
                      s.id === currentId,
                    )}`}
                  >
                    {toPersianDigits(String(s.order))}
                  </div>
                  {i < ordered.length - 1 && (
                    <div
                      className={`h-0.5 w-6 shrink-0 rounded-full ${connectorClass(s.status)}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-text-secondary">
                {current ? (
                  <>
                    مرحله فعلی:{" "}
                    <span className="font-medium text-text">{current.title}</span>
                  </>
                ) : (
                  <span className="font-medium text-success">
                    همهٔ مراحل انجام شد
                  </span>
                )}
              </div>
              <div className="text-text-secondary" dir="rtl">
                {toPersianDigits(String(passed))} از {toPersianDigits(String(total))}{" "}
                مرحله
                {" · "}
                <span className="font-medium text-text">
                  {toPersianDigits(String(percent))}٪
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-badge bg-page">
              <div
                className="h-full rounded-badge bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {ordered.length === 0 && !(canAddStage && periodId) && (
        <div className={placeholder}>برای این پرونده مرحله‌ای تعریف نشده است.</div>
      )}

      <ul className="space-y-2">
        {ordered.map((s) => {
          const isCurrent = s.id === currentId;
          return (
            <li
              key={s.id}
              className={`rounded-card border bg-card p-3 shadow-card transition-colors ${
                isCurrent ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${circleClass(
                      s.status,
                      false,
                    )}`}
                  >
                    {toPersianDigits(String(s.order))}
                  </span>
                  <span
                    className={`text-sm ${
                      s.status === "NOT_NEEDED"
                        ? "text-text-secondary line-through"
                        : "text-text"
                    }`}
                  >
                    {s.title}
                  </span>
                  {s.isExceptional && (
                    <span className={`${badge} bg-info-bg text-info`}>استثنائی</span>
                  )}
                  {s.attemptCount > 1 && (
                    <span className={`${badge} bg-warning-bg text-warning`}>
                      {toPersianDigits(String(s.attemptCount))} تلاش
                    </span>
                  )}
                </div>
                <span className={`${badge} ${STAGE_STATUS_BADGE[s.status]}`}>
                  {STAGE_STATUS_LABELS[s.status]}
                </span>
              </div>

              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                {s.startDate && (
                  <div className="flex gap-1">
                    <dt>شروع:</dt>
                    <dd dir="ltr">{toPersianDigits(s.startDate)}</dd>
                  </div>
                )}
                {s.endDate && (
                  <div className="flex gap-1">
                    <dt>پایان:</dt>
                    <dd dir="ltr">{toPersianDigits(s.endDate)}</dd>
                  </div>
                )}
                {s.dueDate && (
                  <div className="flex gap-1">
                    <dt>سررسید:</dt>
                    <dd dir="ltr">{toPersianDigits(s.dueDate)}</dd>
                  </div>
                )}
                {s.lastChangedByName && (
                  <div className="flex gap-1">
                    <dt>آخرین تغییر:</dt>
                    <dd>{s.lastChangedByName}</dd>
                  </div>
                )}
              </dl>

              {s.note && (
                <p className="mt-2 rounded-control bg-page px-3 py-2 text-xs text-text">
                  {s.note}
                </p>
              )}

              {renderActions(s)}
            </li>
          );
        })}
      </ul>

      {canAddStage && periodId && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <input
            type="text"
            dir="rtl"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان مرحلهٔ استثنائی"
            maxLength={200}
            disabled={working || isCancelled}
            className="min-h-[44px] flex-1 rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={add}
            disabled={working || isCancelled || !newTitle.trim()}
            className="min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            افزودن مرحله
          </button>
        </div>
      )}

      {dueDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-card border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 text-base font-bold text-text">
              {pendingAutoPrompt ? "تعیین سررسید مرحلهٔ بعد" : "تعیین سررسید مرحله"}
            </h3>
            <JalaliDatePicker
              value={dueDialog.value}
              onChange={(v) => setDueDialog({ ...dueDialog, value: v })}
              placeholder="۱۴۰۵/۰۷/۰۱"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDueDialog(null);
                  setPendingAutoPrompt(null);
                }}
                className={btn}
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => saveDue(dueDialog.stageId, dueDialog.value)}
                disabled={working}
                className={btnPrimary}
              >
                ثبت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}