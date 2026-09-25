"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception): the module
// barrel re-exports server-only code, so client components import types + the
// module's own lib directly, never "@/modules/paths".
import type { PathStageRow, PathType } from "@/modules/paths/paths.types";
import { toPersianDigits } from "@/lib/digits";
import { PATH_TYPE_LABELS } from "../lib/labels";

// One ordered path editor (B-2): add a stage at the end, rename in place, move
// up/down, delete. A stage is a title only. Every action saves immediately
// (no bottom save button), mirroring the settings editable-list pattern.

type Props = {
  serviceId: string;
  pathType: PathType;
  stages: PathStageRow[];
  canEdit: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const btn =
  "rounded-control px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

export function PathEditor({ serviceId, pathType, stages, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const base = `/api/services/${serviceId}/stages`;

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
    const data = await call(base, "POST", { pathType, title: newTitle });
    setBusy(false);
    if (data.ok) {
      setNewTitle("");
      router.refresh();
    } else {
      setAddError(data.message ?? "افزودن مرحله انجام نشد.");
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", { title: editTitle });
    setBusy(false);
    if (data.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      setRowError({ id, message: data.message ?? "ذخیره انجام نشد." });
    }
  }

  async function mutate(id: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", body);
    setBusy(false);
    if (data.ok) router.refresh();
    else setRowError({ id, message: data.message ?? "عملیات انجام نشد." });
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
      <h3 className="mb-4 text-base font-bold text-text">
        {PATH_TYPE_LABELS[pathType]}
      </h3>

      <div className="space-y-3">
        {canEdit && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-start gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="عنوان مرحله جدید"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={add}
                disabled={busy || newTitle.trim().length < 2}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
              >
                افزودن مرحله
              </button>
            </div>
            {addError && <p className="text-sm text-error">{addError}</p>}
          </div>
        )}

        {stages.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            هنوز مرحله‌ای تعریف نشده.
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-control border border-border">
            {stages.map((stage, index) => (
              <li key={stage.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 shrink-0 text-sm text-text-secondary">
                    {toPersianDigits(String(index + 1))}
                  </span>
                  {editingId === stage.id ? (
                    <>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(stage.id)}
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
                      <span className="flex-1 text-sm text-text">{stage.title}</span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="بالا"
                            onClick={() => mutate(stage.id, { direction: "up" })}
                            disabled={busy || index === 0}
                            className={`${btn} text-text-secondary hover:bg-page`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="پایین"
                            onClick={() => mutate(stage.id, { direction: "down" })}
                            disabled={busy || index === stages.length - 1}
                            className={`${btn} text-text-secondary hover:bg-page`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(stage.id);
                              setEditTitle(stage.title);
                              setRowError(null);
                            }}
                            className={`${btn} text-primary hover:bg-page`}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(stage.id)}
                            disabled={busy}
                            className={`${btn} text-error hover:bg-error-bg`}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {rowError?.id === stage.id && (
                  <p className="mt-1.5 text-sm text-error">{rowError.message}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
