"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception): the module
// barrel re-exports server-only code, so client components import types + the
// module's own lib directly, never "@/modules/settings".
import type { ListItem, ListKind } from "@/modules/settings/settings.types";
import type { RenewalEffect } from "@/types/enums";
import { RENEWAL_EFFECT_LABELS, RENEWAL_EFFECT_OPTIONS } from "../lib/labels";

// The shared editable-list pattern (B-5/B-6/B-7): add at the top; each row is
// in-place editable with move up/down, an active toggle, and delete. Deletion
// is refused server-side when the item is in use — the returned Persian message
// is shown inline. Every action saves immediately (no bottom save button).

type Props = {
  kind: ListKind;
  items: ListItem[];
  canEdit: boolean;
  /** Follow-up results carry an effect-on-renewal field (B-6). */
  withEffect?: boolean;
  addLabel: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const btn =
  "rounded-control px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

export function EditableList({
  kind,
  items,
  canEdit,
  withEffect = false,
  addLabel,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEffect, setNewEffect] = useState<RenewalEffect>("NONE");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEffect, setEditEffect] = useState<RenewalEffect>("NONE");

  const base = `/api/settings/lists/${kind}`;

  async function call(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<{ ok: boolean; field?: string; message?: string }> {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    try {
      return (await res.json()) as {
        ok: boolean;
        field?: string;
        message?: string;
      };
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
      ...(withEffect ? { effectOnRenewal: newEffect } : {}),
    });
    setBusy(false);
    if (data.ok) {
      setNewTitle("");
      setNewEffect("NONE");
      router.refresh();
    } else {
      setAddError(data.message ?? "افزودن انجام نشد.");
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", {
      title: editTitle,
      ...(withEffect ? { effectOnRenewal: editEffect } : {}),
    });
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
    <div className="space-y-3">
      {canEdit && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="عنوان جدید"
              className={`${inputClass} flex-1`}
            />
            {withEffect && (
              <select
                value={newEffect}
                onChange={(e) => setNewEffect(e.target.value as RenewalEffect)}
                className={`${inputClass} w-44`}
              >
                {RENEWAL_EFFECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={add}
              disabled={busy || newTitle.trim().length < 2}
              className={`${btn} bg-primary text-white hover:bg-primary-hover`}
            >
              {addLabel}
            </button>
          </div>
          {addError && <p className="text-sm text-error">{addError}</p>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
          هنوز موردی تعریف نشده.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-control border border-border">
          {items.map((item, index) => (
            <li key={item.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {editingId === item.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    {withEffect && (
                      <select
                        value={editEffect}
                        onChange={(e) =>
                          setEditEffect(e.target.value as RenewalEffect)
                        }
                        className={`${inputClass} w-44`}
                      >
                        {RENEWAL_EFFECT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => saveEdit(item.id)}
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
                    <span
                      className={`flex-1 text-sm ${
                        item.active ? "text-text" : "text-disabled line-through"
                      }`}
                    >
                      {item.title}
                    </span>
                    {withEffect && item.effectOnRenewal && (
                      <span className="rounded-badge bg-info-bg px-2 py-0.5 text-xs text-info">
                        {RENEWAL_EFFECT_LABELS[item.effectOnRenewal]}
                      </span>
                    )}
                    {!item.active && (
                      <span className="rounded-badge bg-disabled-bg px-2 py-0.5 text-xs text-disabled">
                        غیرفعال
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="بالا"
                          onClick={() => mutate(item.id, { direction: "up" })}
                          disabled={busy || index === 0}
                          className={`${btn} text-text-secondary hover:bg-page`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="پایین"
                          onClick={() => mutate(item.id, { direction: "down" })}
                          disabled={busy || index === items.length - 1}
                          className={`${btn} text-text-secondary hover:bg-page`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => mutate(item.id, { active: !item.active })}
                          disabled={busy}
                          className={`${btn} text-text-secondary hover:bg-page`}
                        >
                          {item.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditTitle(item.title);
                            setEditEffect(item.effectOnRenewal ?? "NONE");
                            setRowError(null);
                          }}
                          className={`${btn} text-primary hover:bg-page`}
                        >
                          ویرایش
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
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
              {rowError?.id === item.id && (
                <p className="mt-1.5 text-sm text-error">{rowError.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
