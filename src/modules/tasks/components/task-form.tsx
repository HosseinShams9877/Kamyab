"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (client-component exception): never a module barrel.
import type { TaskFormData, TaskPriorityKey } from "../tasks.types";
import { TASK_PRIORITY_LABELS } from "../lib/labels";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { PersianTimePicker } from "@/components/ui/persian-time-picker";

// The standalone task-create form (C-11), hosted at /tasks/new. Every pick
// field uses the shared SearchableSelect; the date uses JalaliDatePicker; the
// time uses PersianTimePicker (two scroll columns + a "now" shortcut).

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const labelCls = "mb-1 block text-xs text-text-secondary";

const PRIORITIES: TaskPriorityKey[] = ["NORMAL", "HIGH", "URGENT"];

/** Required-field marker. */
function Req() {
  return <span className="text-error"> *</span>;
}

export function TaskForm({ data }: { data: TaskFormData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(data.currentUserId);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<TaskPriorityKey>("NORMAL");
  const [note, setNote] = useState("");

  const working = busy || pending;

  const caseOptions = customerId
    ? data.casesByCustomer[customerId] ?? []
    : data.cases;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caseId,
          customerId,
          ownerId,
          dueDate,
          dueTime,
          priority,
          note,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "ثبت کار انجام نشد.");
        return;
      }
      startTransition(() => {
        router.push("/tasks");
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>
            عنوان
            <Req />
          </label>
          <input
            type="text"
            maxLength={150}
            dir="rtl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={working}
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>مشتری</label>
          <SearchableSelect
            value={customerId}
            onChange={(v) => {
              setCustomerId(v);
              setCaseId("");
            }}
            options={data.customers.map((c) => ({
              value: c.id,
              label: c.displayName,
            }))}
            placeholder="— انتخاب مشتری —"
            emptyLabel="بدون مشتری"
          />
        </div>

        <div>
          <label className={labelCls}>پرونده</label>
          <SearchableSelect
            value={caseId}
            onChange={setCaseId}
            options={caseOptions.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            placeholder="— انتخاب پرونده —"
            emptyLabel="بدون پرونده"
          />
        </div>

        <div>
          <label className={labelCls}>
            مسئول
            <Req />
          </label>
          <SearchableSelect
            value={ownerId}
            onChange={setOwnerId}
            options={data.owners.map((o) => ({
              value: o.id,
              label: o.fullName,
            }))}
            placeholder="— انتخاب مسئول —"
          />
        </div>

        <div>
          <label className={labelCls}>
            اولویت
            <Req />
          </label>
          <SearchableSelect
            value={priority}
            onChange={(v) => setPriority(v as TaskPriorityKey)}
            options={PRIORITIES.map((p) => ({
              value: p,
              label: TASK_PRIORITY_LABELS[p],
            }))}
            placeholder="— انتخاب اولویت —"
          />
        </div>

        <div>
          <label className={labelCls}>
            تاریخ سررسید
            <Req />
          </label>
          <JalaliDatePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder="۱۴۰۵/۰۷/۰۱"
          />
        </div>

        <div>
          <label className={labelCls}>ساعت</label>
          <PersianTimePicker
            value={dueTime}
            onChange={setDueTime}
            disabled={working}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>یادداشت</label>
          <input
            type="text"
            maxLength={500}
            dir="rtl"
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
          onClick={submit}
          disabled={working || !title.trim() || !dueDate.trim() || !ownerId}
          className={primaryBtn}
        >
          {working ? "در حال ثبت…" : "ثبت کار"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/tasks")}
          disabled={working}
          className={ghostBtn}
        >
          انصراف
        </button>
      </div>
    </div>
  );
}