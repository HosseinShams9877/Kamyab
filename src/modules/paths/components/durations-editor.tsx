"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception).
import type { DurationRow } from "@/modules/paths/paths.types";
import { toPersianDigits } from "@/lib/digits";

// Validity durations editor (B-3): add a duration (title + month count), mark one
// as default, rename/edit, delete. A duration already used by a case is
// rename-only (month count + default frozen) and cannot be deleted — the server
// enforces this and returns a Persian message shown inline.

type Props = {
  serviceId: string;
  durations: DurationRow[];
  canEdit: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const btn =
  "rounded-control px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

export function DurationsEditor({ serviceId, durations, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMonths, setNewMonths] = useState("");
  const [newDefault, setNewDefault] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMonths, setEditMonths] = useState("");
  const [editDefault, setEditDefault] = useState(false);

  const base = `/api/services/${serviceId}/durations`;

  async function call(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    try {
      return (await res.json()) as { ok: boolean; message?: string };
    } catch {
      return { ok: res.ok };
    }
  }

  async function add() {
    setAddError(null);
    if (busy) return;
    setBusy(true);
    const data = await call(base, "POST", {
      title: newTitle,
      monthCount: newMonths,
      isDefault: newDefault,
    });
    setBusy(false);
    if (data.ok) {
      setNewTitle("");
      setNewMonths("");
      setNewDefault(false);
      router.refresh();
    } else {
      setAddError(data.message ?? "افزودن مدت اعتبار انجام نشد.");
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", {
      title: editTitle,
      monthCount: editMonths,
      isDefault: editDefault,
    });
    setBusy(false);
    if (data.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      setRowError({ id, message: data.message ?? "ذخیره انجام نشد." });
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "DELETE");
    setBusy(false);
    if (data.ok) router.refresh();
    else setRowError({ id, message: data.message ?? "حذف انجام نشد." });
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-card">
      <h3 className="mb-4 text-base font-bold text-text">مدت‌های اعتبار</h3>

      <div className="space-y-3">
        {canEdit && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-start gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="عنوان (مثلاً ۱ ساله)"
                className={`${inputClass} flex-1`}
              />
              <input
                type="text"
                inputMode="numeric"
                value={newMonths}
                onChange={(e) => setNewMonths(e.target.value)}
                placeholder="تعداد ماه"
                className={`${inputClass} w-28`}
              />
              <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text">
                <input
                  type="checkbox"
                  checked={newDefault}
                  onChange={(e) => setNewDefault(e.target.checked)}
                />
                پیش‌فرض
              </label>
              <button
                type="button"
                onClick={add}
                disabled={busy || newTitle.trim().length < 1 || newMonths.trim() === ""}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
              >
                افزودن مدت
              </button>
            </div>
            {addError && <p className="text-sm text-error">{addError}</p>}
          </div>
        )}

        {durations.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            هنوز مدت اعتباری تعریف نشده.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {durations.map((d) => (
              <li key={d.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {editingId === d.id ? (
                    <>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editMonths}
                        onChange={(e) => setEditMonths(e.target.value)}
                        disabled={d.inUse}
                        className={`${inputClass} w-28 disabled:bg-disabled-bg`}
                      />
                      <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text">
                        <input
                          type="checkbox"
                          checked={editDefault}
                          onChange={(e) => setEditDefault(e.target.checked)}
                          disabled={d.inUse}
                        />
                        پیش‌فرض
                      </label>
                      <button
                        type="button"
                        onClick={() => saveEdit(d.id)}
                        disabled={busy}
                        className={`${btn} bg-primary text-white hover:bg-primary-hover`}
                      >
                        ذخیره
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`${btn} text-text-secondary hover:bg-page`}
                      >
                        انصراف
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-text">{d.title}</span>
                      <span className="text-sm text-text-secondary">
                        {toPersianDigits(String(d.monthCount))} ماه
                      </span>
                      {d.isDefault && (
                        <span className="rounded-badge bg-success-bg px-2 py-0.5 text-xs text-success">
                          پیش‌فرض
                        </span>
                      )}
                      {d.inUse && (
                        <span className="rounded-badge bg-info-bg px-2 py-0.5 text-xs text-info">
                          در حال استفاده
                        </span>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(d.id);
                              setEditTitle(d.title);
                              setEditMonths(String(d.monthCount));
                              setEditDefault(d.isDefault);
                              setRowError(null);
                            }}
                            className={`${btn} text-primary hover:bg-page`}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(d.id)}
                            disabled={busy || d.inUse}
                            title={d.inUse ? "مدت در حال استفاده قابل حذف نیست" : undefined}
                            className={`${btn} text-error hover:bg-error-bg`}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {rowError?.id === d.id && (
                  <p className="mt-1.5 text-sm text-error">{rowError.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
