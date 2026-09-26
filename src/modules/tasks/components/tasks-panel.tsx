"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
// Isomorphic leaf imports (client-component exception): never a module barrel.
import type { TaskRow, TaskTab, TaskFormData, TaskPriorityKey } from "../tasks.types";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
} from "../lib/labels";

// The interactive tasks page body (C-11), hosted at /tasks. It owns the seven-tab
// navigation, the create/edit form, the per-row actions (record result, archive /
// unarchive, delete with confirm), and the record-result form. A client leaf: it
// imports only isomorphic leaves and calls the guarded task API routes, then
// refreshes so overdue/tab membership recompute (rule 2 — never stored). The server
// re-checks every request (rule 3); the capability flags + ownership only decide
// which controls are shown.

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const smallBtn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const labelCls = "mb-1 block text-xs text-text-secondary";
const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

const PRIORITIES: TaskPriorityKey[] = ["NORMAL", "HIGH", "URGENT"];

export type TaskCaps = {
  create: boolean;
  assign: boolean;
  record: boolean;
  archive: boolean;
  delete: boolean;
};

// PANEL_BODY

export function TasksPanel({
  tasks,
  tab,
  tabs,
  formData,
  results,
  caps,
  viewAll,
}: {
  tasks: TaskRow[];
  tab: TaskTab;
  tabs: { key: TaskTab; label: string }[];
  formData: TaskFormData;
  results: { id: string; title: string }[];
  caps: TaskCaps;
  viewAll: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [ownerId, setOwnerId] = useState(formData.currentUserId);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriorityKey>("NORMAL");
  const [note, setNote] = useState("");

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [resultId, setResultId] = useState(results[0]?.id ?? "");
  const [resultNote, setResultNote] = useState("");
  const [nextTask, setNextTask] = useState(false);
  const [nextTitle, setNextTitle] = useState("");
  const [nextDue, setNextDue] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const working = busy || pending;

  // Per-row authorization mirrors the server guard `can(user, key, { ownerId })`:
  // without view_all, a user may act only on tasks they own (rule 3). The API
  // routes re-check; this only decides which buttons render.
  const owns = (t: TaskRow) => viewAll || t.ownerId === formData.currentUserId;
  const canEditRow = (t: TaskRow) => caps.create && owns(t) && t.status === "OPEN";
  const canRecordRow = (t: TaskRow) => caps.record && owns(t) && t.status === "OPEN";
  const canArchiveRow = (t: TaskRow) => caps.archive && owns(t);
  const canDeleteRow = (t: TaskRow) => caps.delete && owns(t) && !t.hasFollowUp;

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
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setCaseId("");
    setOwnerId(formData.currentUserId);
    setDueDate("");
    setPriority("NORMAL");
    setNote("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(t: TaskRow) {
    setEditingId(t.id);
    setTitle(t.title);
    setCaseId(t.caseId ?? "");
    setOwnerId(t.ownerId);
    setDueDate(t.dueDate);
    setPriority(t.priority);
    setNote(t.note ?? "");
    setError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    const body = { title, caseId, ownerId, dueDate, priority, note };
    const ok = editingId
      ? await call("PATCH", `/api/tasks/${editingId}`, body)
      : await call("POST", "/api/tasks", body);
    if (ok) setFormOpen(false);
  }

  function openRecord(t: TaskRow) {
    setRecordingId(t.id);
    setResultId(results[0]?.id ?? "");
    setResultNote("");
    setNextTask(false);
    setNextTitle("");
    setNextDue("");
    setError(null);
  }

  async function submitRecord(taskId: string) {
    const ok = await call("POST", `/api/tasks/${taskId}/result`, {
      resultId,
      note: resultNote,
      nextTask,
      nextTaskTitle: nextTitle,
      nextTaskDueDate: nextDue,
    });
    if (ok) setRecordingId(null);
  }

  const setArchive = (t: TaskRow, archived: boolean) =>
    call("POST", `/api/tasks/${t.id}/archive`, { archived });
  const remove = (t: TaskRow) =>
    call("DELETE", `/api/tasks/${t.id}`).then((ok) => ok && setConfirmDeleteId(null));

  // FORM_AND_LIST
  return (
    <div>
      {/* Tab bar: scrolls horizontally on narrow screens, ≥44px touch targets. */}
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/tasks?tab=${t.key}`}
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

      {caps.create && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => (formOpen && !editingId ? setFormOpen(false) : openCreate())}
            disabled={working}
            className={primaryBtn}
          >
            کار جدید
          </button>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}

      {formOpen && (
        <div className="mb-4 rounded-card border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-medium text-text">
            {editingId ? "ویرایش کار" : "کار جدید"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="t-title">عنوان</label>
              <input
                id="t-title"
                type="text"
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="t-case">پروندهٔ مرتبط (اختیاری)</label>
              <select
                id="t-case"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                disabled={working}
                className={field}
              >
                <option value="">بدون پرونده</option>
                {formData.cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="t-owner">مسئول</label>
              <select
                id="t-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={working || !caps.assign}
                className={field}
              >
                {formData.owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="t-due">تاریخ سررسید</label>
              <input
                id="t-due"
                type="text"
                dir="ltr"
                placeholder="۱۴۰۳/۰۵/۰۱"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="t-priority">اولویت</label>
              <select
                id="t-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriorityKey)}
                disabled={working}
                className={field}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="t-note">یادداشت (اختیاری)</label>
              <input
                id="t-note"
                type="text"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submitForm}
              disabled={working || !title.trim() || !dueDate.trim() || !ownerId}
              className={primaryBtn}
            >
              ثبت
            </button>
            <button type="button" onClick={() => setFormOpen(false)} disabled={working} className={ghostBtn}>
              انصراف
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className={placeholder}>کاری در این نما وجود ندارد.</div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-card border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text break-words">{t.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span dir="ltr">سررسید: {toPersianDigits(t.dueDate)}</span>
                    <span>مسئول: {t.ownerName}</span>
                    {t.caseNumber && <span dir="ltr">پرونده: {toPersianDigits(t.caseNumber)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`${badge} ${TASK_PRIORITY_BADGE[t.priority]}`}>
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </span>
                  {t.overdue && <span className={`${badge} bg-error-bg text-error`}>عقب‌افتاده</span>}
                  {t.status !== "OPEN" && (
                    <span className={`${badge} bg-page text-text-secondary`}>
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  )}
                  {t.archivedAt && <span className={`${badge} bg-page text-text-secondary`}>بایگانی</span>}
                </div>
              </div>

              {t.note && (
                <p className="mt-2 rounded-control bg-page px-3 py-2 text-xs text-text break-words">
                  {t.note}
                </p>
              )}

              {/* Row actions. Record-result needs the task to belong to a case. */}
              <div className="mt-3 flex flex-wrap gap-2">
                {canRecordRow(t) && recordingId !== t.id && (
                  <button
                    type="button"
                    onClick={() => openRecord(t)}
                    disabled={working || !t.caseId}
                    title={t.caseId ? undefined : "این کار به پرونده‌ای متصل نیست"}
                    className={smallBtn}
                  >
                    ثبت نتیجه
                  </button>
                )}
                {canEditRow(t) && (
                  <button type="button" onClick={() => openEdit(t)} disabled={working} className={smallBtn}>
                    ویرایش
                  </button>
                )}
                {canArchiveRow(t) && !t.archivedAt && (
                  <button type="button" onClick={() => setArchive(t, true)} disabled={working} className={smallBtn}>
                    بایگانی
                  </button>
                )}
                {canArchiveRow(t) && t.archivedAt && (
                  <button type="button" onClick={() => setArchive(t, false)} disabled={working} className={smallBtn}>
                    خروج از بایگانی
                  </button>
                )}
                {canDeleteRow(t) &&
                  (confirmDeleteId === t.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-secondary">این کار حذف شود؟</span>
                      <button type="button" onClick={() => remove(t)} disabled={working} className={`${smallBtn} text-error`}>
                        بله، حذف کن
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={working} className={smallBtn}>
                        انصراف
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(t.id)} disabled={working} className={`${smallBtn} text-error`}>
                      حذف
                    </button>
                  ))}
              </div>

              {/* Inline record-result form (C-11 / B-6). */}
              {recordingId === t.id && (
                <div className="mt-3 rounded-control border border-border bg-page p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor={`r-result-${t.id}`}>نتیجهٔ پیگیری</label>
                      <select
                        id={`r-result-${t.id}`}
                        value={resultId}
                        onChange={(e) => setResultId(e.target.value)}
                        disabled={working}
                        className={field}
                      >
                        {results.length === 0 && <option value="">—</option>}
                        {results.map((r) => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`r-note-${t.id}`}>یادداشت (اختیاری)</label>
                      <input
                        id={`r-note-${t.id}`}
                        type="text"
                        maxLength={500}
                        value={resultNote}
                        onChange={(e) => setResultNote(e.target.value)}
                        disabled={working}
                        className={field}
                      />
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={nextTask}
                      onChange={(e) => setNextTask(e.target.checked)}
                      disabled={working}
                      className="h-4 w-4"
                    />
                    ایجاد کار بعدی
                  </label>
                  {nextTask && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls} htmlFor={`r-nt-${t.id}`}>عنوان کار بعدی (اختیاری)</label>
                        <input
                          id={`r-nt-${t.id}`}
                          type="text"
                          maxLength={150}
                          placeholder={t.title}
                          value={nextTitle}
                          onChange={(e) => setNextTitle(e.target.value)}
                          disabled={working}
                          className={field}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor={`r-nd-${t.id}`}>تاریخ سررسید کار بعدی</label>
                        <input
                          id={`r-nd-${t.id}`}
                          type="text"
                          dir="ltr"
                          placeholder="۱۴۰۳/۰۵/۰۱"
                          value={nextDue}
                          onChange={(e) => setNextDue(e.target.value)}
                          disabled={working}
                          className={field}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitRecord(t.id)}
                      disabled={working || !resultId || (nextTask && !nextDue.trim())}
                      className={primaryBtn}
                    >
                      ثبت نتیجه
                    </button>
                    <button type="button" onClick={() => setRecordingId(null)} disabled={working} className={ghostBtn}>
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


