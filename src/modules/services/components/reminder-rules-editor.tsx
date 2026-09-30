"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception).
import type { ReminderRuleRow } from "@/modules/services/services.types";
import type { ReminderChannel, ReminderRecipient } from "@/types/enums";
import {
  REMINDER_RECIPIENT_LABELS,
  REMINDER_RECIPIENT_OPTIONS,
  daysBeforeLabel,
} from "../lib/labels";

// One reminder-rules editor scoped to a single channel (B-4): the service has
// two independent lists — internal notifications (INTERNAL_NOTIFICATION) and
// customer SMS (SMS_TO_CUSTOMER). The channel is fixed by the parent; the
// recipient picker is restricted to the recipients valid for that channel.
//
// IMPORTANT: this component filters `rules` to its own channel internally, so
// the parent may pass the FULL list (both channels) — the other channel's rules
// never leak into this editor. Keeping the filter here (not in the parent) means
// no caller can accidentally render a rule in both editors.

type Props = {
  serviceId: string;
  channel: ReminderChannel;
  rules: ReminderRuleRow[];
  canEdit: boolean;
};

const inputClass =
  "rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const btn =
  "rounded-control px-3 py-2 text-sm transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0 sm:py-1.5";

type Draft = {
  daysBefore: string;
  recipient: ReminderRecipient;
  active: boolean;
};

/** Valid recipients per channel. */
const RECIPIENTS_BY_CHANNEL: Record<ReminderChannel, ReminderRecipient[]> = {
  INTERNAL_NOTIFICATION: ["CASE_OWNER", "ALL_MANAGERS"],
  SMS_TO_CUSTOMER: ["CUSTOMER"],
};

const TITLE_BY_CHANNEL: Record<ReminderChannel, string> = {
  INTERNAL_NOTIFICATION: "یادآوری داخلی",
  SMS_TO_CUSTOMER: "پیامک مشتری",
};

function emptyDraft(channel: ReminderChannel): Draft {
  return {
    daysBefore: "",
    recipient: RECIPIENTS_BY_CHANNEL[channel][0],
    active: true,
  };
}

// Hoisted to module scope on purpose: a stable component identity keeps input
// focus across keystrokes.
function DraftFields({
  value,
  onChange,
  channel,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
  channel: ReminderChannel;
}) {
  const allowed = RECIPIENTS_BY_CHANNEL[channel];
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        dir="rtl"
        value={value.daysBefore}
        onChange={(e) => onChange({ ...value, daysBefore: e.target.value })}
        placeholder="روز قبل از انقضا"
        className={`${inputClass} w-full sm:w-36`}
      />
      <select
        dir="rtl"
        value={value.recipient}
        onChange={(e) =>
          onChange({ ...value, recipient: e.target.value as ReminderRecipient })
        }
        className={`${inputClass} w-full sm:w-auto`}
      >
        {REMINDER_RECIPIENT_OPTIONS.filter((o) => allowed.includes(o.value)).map(
          (o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ),
        )}
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

export function ReminderRulesEditor({ serviceId, channel, rules, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(channel));
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(() => emptyDraft(channel));

  // Filter to this channel's rules — callers may pass the full list.
  const ownRules = rules.filter((r) => r.channel === channel);

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
    const data = await call(base, "POST", { ...draft, channel });
    setBusy(false);
    if (data.ok) {
      setDraft(emptyDraft(channel));
      router.refresh();
    } else {
      setAddError(data.message ?? "افزودن قاعده انجام نشد.");
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    const data = await call(`${base}/${id}`, "PATCH", { ...editDraft, channel });
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
      channel,
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

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-card">
      <h3 className="mb-4 text-base font-bold text-text">
        {TITLE_BY_CHANNEL[channel]}
      </h3>

      <div className="space-y-3">
        {canEdit && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <DraftFields value={draft} onChange={setDraft} channel={channel} />
              <button
                type="button"
                onClick={add}
                disabled={busy || draft.daysBefore.trim() === ""}
                className={`${btn} bg-primary text-white hover:bg-primary-hover`}
              >
                + افزودن قاعده
              </button>
            </div>
            {addError && <p className="text-sm text-error">{addError}</p>}
          </div>
        )}

        {ownRules.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            هنوز قاعده‌ای تعریف نشده.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {ownRules.map((rule) => (
              <li key={rule.id} className="px-3 py-2.5">
                {editingId === rule.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <DraftFields
                      value={editDraft}
                      onChange={setEditDraft}
                      channel={channel}
                    />
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
                    <span className="rounded-badge bg-page px-2 py-0.5 text-xs text-text-secondary">
                      {REMINDER_RECIPIENT_LABELS[rule.recipient]}
                    </span>
                    {!rule.active && (
                      <span className="rounded-badge bg-disabled-bg px-2 py-0.5 text-xs text-disabled">
                        غیرفعال
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-1">
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