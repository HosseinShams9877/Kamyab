"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception).
import type { ReminderRuleRow } from "@/modules/services/services.types";
import type { ReminderChannel, ReminderRecipient } from "@/types/enums";
import {
  REMINDER_CHANNEL_LABELS,
  REMINDER_CHANNEL_OPTIONS,
  REMINDER_RECIPIENT_LABELS,
  REMINDER_RECIPIENT_OPTIONS,
  daysBeforeLabel,
} from "../lib/labels";

// Reminder rules editor (B-4): each rule is days-before-expiry (positive = before,
// zero = on expiry, negative = after), a channel, a recipient, and an active
// flag. Add/edit/toggle/delete save immediately. Only shown for renewable
// services (the detail page hides it otherwise; the API re-checks).

type Props = {
  serviceId: string;
  rules: ReminderRuleRow[];
  canEdit: boolean;
};

const inputClass =
  "rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const btn =
  "rounded-control px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

type Draft = {
  daysBefore: string;
  channel: ReminderChannel;
  recipient: ReminderRecipient;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  daysBefore: "",
  channel: "INTERNAL_NOTIFICATION",
  recipient: "CASE_OWNER",
  active: true,
};

export function ReminderRulesEditor({ serviceId, rules, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  const base = `/api/services/${serviceId}/reminder-rules`;

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
    const data = await call(base, "POST", draft);
    setBusy(false);
    if (data.ok) {
      setDraft(EMPTY_DRAFT);
      router.refresh();
    } else {
      setAddError(data.message ?? "افزودن قاعده انجام نشد.");
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", editDraft);
    setBusy(false);
    if (data.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      setRowError({ id, message: data.message ?? "ذخیره انجام نشد." });
    }
  }

  async function toggleActive(rule: ReminderRuleRow) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${rule.id}`, "PATCH", {
      daysBefore: rule.daysBefore,
      channel: rule.channel,
      recipient: rule.recipient,
      active: !rule.active,
    });
    setBusy(false);
    if (data.ok) router.refresh();
    else setRowError({ id: rule.id, message: data.message ?? "عملیات انجام نشد." });
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

  function DraftFields({
    value,
    onChange,
  }: {
    value: Draft;
    onChange: (d: Draft) => void;
  }) {
    return (
      <>
        <input
          type="text"
          inputMode="numeric"
          value={value.daysBefore}
          onChange={(e) => onChange({ ...value, daysBefore: e.target.value })}
          placeholder="روز نسبت به انقضا"
          className={`${inputClass} w-36`}
        />
        <select
          value={value.channel}
          onChange={(e) =>
            onChange({ ...value, channel: e.target.value as ReminderChannel })
          }
          className={inputClass}
        >
          {REMINDER_CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={value.recipient}
          onChange={(e) =>
            onChange({ ...value, recipient: e.target.value as ReminderRecipient })
          }
          className={inputClass}
        >
          {REMINDER_RECIPIENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => onChange({ ...value, active: e.target.checked })}
          />
          فعال
        </label>
      </>
    );
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-card">
      <h3 className="mb-4 text-base font-bold text-text">قواعد یادآوری</h3>

      <div className="space-y-3">
        {canEdit && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <DraftFields value={draft} onChange={setDraft} />
              <button
                type="button"
                onClick={add}
                disabled={busy || draft.daysBefore.trim() === ""}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
              >
                افزودن قاعده
              </button>
            </div>
            {addError && <p className="text-sm text-error">{addError}</p>}
          </div>
        )}

        {rules.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            هنوز قاعده‌ای تعریف نشده.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {rules.map((rule) => (
              <li key={rule.id} className="px-3 py-2.5">
                {editingId === rule.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <DraftFields value={editDraft} onChange={setEditDraft} />
                    <button
                      type="button"
                      onClick={() => saveEdit(rule.id)}
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
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 text-sm text-text">
                      {daysBeforeLabel(rule.daysBefore)}
                    </span>
                    <span className="rounded-badge bg-info-bg px-2 py-0.5 text-xs text-info">
                      {REMINDER_CHANNEL_LABELS[rule.channel]}
                    </span>
                    <span className="rounded-badge bg-page px-2 py-0.5 text-xs text-text-secondary">
                      {REMINDER_RECIPIENT_LABELS[rule.recipient]}
                    </span>
                    {!rule.active && (
                      <span className="rounded-badge bg-disabled-bg px-2 py-0.5 text-xs text-disabled">
                        غیرفعال
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleActive(rule)}
                          disabled={busy}
                          className={`${btn} text-text-secondary hover:bg-page`}
                        >
                          {rule.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(rule.id);
                            setEditDraft({
                              daysBefore: String(rule.daysBefore),
                              channel: rule.channel,
                              recipient: rule.recipient,
                              active: rule.active,
                            });
                            setRowError(null);
                          }}
                          className={`${btn} text-primary hover:bg-page`}
                        >
                          ویرایش
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(rule.id)}
                          disabled={busy}
                          className={`${btn} text-error hover:bg-error-bg`}
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {rowError?.id === rule.id && (
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
