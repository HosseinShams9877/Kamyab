"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import type { StageRow } from "@/modules/periods/periods.types";
import {
  STAGE_STATUS_LABELS,
  STAGE_STATUS_BADGE,
} from "@/modules/periods/lib/labels";

// The interactive Path card (C-6): a horizontal stage strip, the current-stage
// line, and a vertical list with the six actions per stage. Progress and the
// current stage are computed here from the stage rows (rule 2 — never stored).
// A client leaf: it imports only isomorphic leaves and calls the guarded stage
// API routes, then refreshes the server component. The server still gates every
// action (rule 3); `canEdit`/`canAddStage` only decide button visibility.

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "REJECTED"];
const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const btn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

type NoteEditor = { stageId: string; op: "reject" | "note"; value: string } | null;

export function CaseStages({
  stages,
  periodId,
  canEdit,
  canAddStage,
  isCancelled,
}: {
  stages: StageRow[];
  periodId: string | null;
  canEdit: boolean;
  canAddStage: boolean;
  isCancelled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<NoteEditor>(null);
  const [newTitle, setNewTitle] = useState("");

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

  const action = (stageId: string, op: string, note?: string) =>
    call("POST", `/api/cases/stages/${stageId}`, { op, note });
  const move = (stageId: string, op: "move_up" | "move_down") =>
    call("PATCH", `/api/cases/stages/${stageId}`, { op });
  const remove = (stageId: string) => call("DELETE", `/api/cases/stages/${stageId}`);
  const add = () => {
    if (!periodId || !newTitle.trim()) return;
    call("POST", "/api/cases/stages", { periodId, title: newTitle.trim() });
  };

  // BODY_PLACEHOLDER
  function circleClass(status: string, isCurrent: boolean): string {
    const ring = isCurrent ? " ring-2 ring-primary ring-offset-1 ring-offset-card" : "";
    switch (status) {
      case "DONE":
        return "bg-success text-white" + ring;
      case "REJECTED":
        return "bg-error text-white" + ring;
      case "NOT_NEEDED":
        return "bg-disabled-bg text-text-secondary line-through" + ring;
      default:
        return "bg-page text-text-secondary border border-border" + ring;
    }
  }

  return (
    <div>
      {ordered.length > 0 && (
        <>
          {/* Horizontal stage strip — scrolls, never wraps (C-6). */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
            {ordered.map((s) => (
              <div
                key={s.id}
                title={s.title}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs ${circleClass(
                  s.status,
                  s.id === currentId,
                )}`}
              >
                {toPersianDigits(String(s.order))}
              </div>
            ))}
          </div>
          {/* Current-stage line: title — passed of total · percent%. */}
          <p className="mb-4 text-sm text-text-secondary">
            {current ? (
              <>
                مرحله فعلی: <span className="text-text">{current.title}</span>
              </>
            ) : (
              <span className="text-text">همهٔ مراحل انجام شد</span>
            )}
            {" — "}
            {toPersianDigits(String(passed))} از {toPersianDigits(String(total))} مرحله ·{" "}
            {toPersianDigits(String(percent))}٪
          </p>
        </>
      )}

      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {/* LIST_PLACEHOLDER */}
      {ordered.length === 0 && !(canAddStage && periodId) && (
        <div className={placeholder}>برای این پرونده مرحله‌ای تعریف نشده است.</div>
      )}

      <ul className="space-y-2">
        {ordered.map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-border bg-card p-3 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-secondary">
                  {toPersianDigits(String(s.order))}.
                </span>
                <span className="text-sm text-text">{s.title}</span>
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
        ))}
      </ul>

      {canAddStage && periodId && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
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
            className="min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            افزودن مرحله
          </button>
        </div>
      )}
    </div>
  );

  // Per-stage action buttons. Shown only when the user may act (canEdit for the
  // six actions, canAddStage for reorder/delete of an exceptional stage); a
  // cancelled case shows them disabled (C-6 blocked state). Hoisted so the map
  // above stays compact while sharing the component's handlers + closure.
  function renderActions(s: StageRow) {
    const isOpen = OPEN_STATUSES.includes(s.status);
    const disabled = working || isCancelled;
    const acts = canEdit
      ? [
          { key: "start", label: "شروع", show: s.status === "PENDING", on: () => action(s.id, "start") },
          { key: "done", label: "اتمام", show: isOpen, on: () => action(s.id, "done") },
          { key: "reject", label: "رد", show: isOpen, on: () => setEditor({ stageId: s.id, op: "reject", value: "" }) },
          { key: "not_needed", label: "نیازی نیست", show: isOpen, on: () => action(s.id, "not_needed") },
          { key: "reopen", label: "بازگشایی", show: !isOpen, on: () => action(s.id, "reopen") },
          { key: "note", label: "یادداشت", show: true, on: () => setEditor({ stageId: s.id, op: "note", value: s.note ?? "" }) },
        ]
      : [];
    const canMove = canAddStage && s.isExceptional;
    const canDelete = canMove && s.status === "PENDING" && s.attemptCount === 0;
    const visible = acts.filter((a) => a.show);
    if (visible.length === 0 && !canMove && !canDelete && editor?.stageId !== s.id) {
      return null;
    }
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {visible.map((a) => (
            <button key={a.key} type="button" onClick={a.on} disabled={disabled} className={btn}>
              {a.label}
            </button>
          ))}
          {canMove && (
            <>
              <button type="button" onClick={() => move(s.id, "move_up")} disabled={disabled} className={btn} aria-label="انتقال به بالا">▲</button>
              <button type="button" onClick={() => move(s.id, "move_down")} disabled={disabled} className={btn} aria-label="انتقال به پایین">▼</button>
            </>
          )}
          {canDelete && (
            <button type="button" onClick={() => remove(s.id)} disabled={disabled} className={`${btn} text-error`}>
              حذف
            </button>
          )}
        </div>
        {editor?.stageId === s.id && renderEditor(s)}
      </div>
    );
  }
  // EDITOR_FN
  // The Reject / Note dialog: a small inline textarea. Reject requires a note
  // (C-6); the server enforces it too (rule 3).
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
          placeholder={isReject ? "دلیل رد (الزامی)" : "یادداشت مرحله"}
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-secondary"
        />
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => action(s.id, editor.op, editor.value)}
            disabled={working || (isReject && !editor.value.trim())}
            className="min-h-[36px] rounded-control bg-primary px-3 text-xs text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            ثبت
          </button>
          <button type="button" onClick={() => setEditor(null)} disabled={working} className={btn}>
            انصراف
          </button>
        </div>
      </div>
    );
  }
}
