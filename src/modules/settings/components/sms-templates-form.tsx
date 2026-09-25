"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SmsTemplateRow } from "@/modules/settings/settings.types";
import {
  renderPreview,
  smsCountLabel,
  SMS_PLACEHOLDERS,
} from "../lib/sms";
import { smsEventLabel } from "../lib/labels";

// SMS templates (B-10): one editable body per event. Placeholders like
// {customerName} are shown live in the preview against sample data; an unknown
// placeholder is left untouched (never crashes). An empty body means the event
// is skipped by the engine. Character + SMS-part counts update as you type.

function TemplateEditor({
  template,
  canEdit,
}: {
  template: SmsTemplateRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/settings/sms-templates/${encodeURIComponent(template.eventKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const data = (await res.json()) as { ok: boolean; message?: string };
      setMsg(
        res.ok && data.ok
          ? { ok: true, text: "قالب ذخیره شد." }
          : { ok: false, text: data.message ?? "ذخیره انجام نشد." },
      );
      if (res.ok && data.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-control border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">
          {smsEventLabel(template.eventKey)}
        </h3>
        <span className="text-xs text-text-secondary">{smsCountLabel(body)}</span>
      </div>

      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={!canEdit}
        dir="rtl"
        className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SMS_PLACEHOLDERS.map((p) => (
          <span
            key={p.token}
            title={p.label}
            className="rounded-badge bg-page px-2 py-0.5 text-xs text-text-secondary"
            dir="ltr"
          >
            {`{${p.token}}`}
          </span>
        ))}
      </div>

      <div className="mt-3 rounded-control bg-page px-3 py-2">
        <span className="text-xs text-text-secondary">پیش‌نمایش:</span>
        <p className="mt-1 whitespace-pre-wrap text-sm text-text">
          {body.trim() ? renderPreview(body) : "— (این رویداد ارسال نمی‌شود)"}
        </p>
      </div>

      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-success" : "text-error"}`}>
          {msg.text}
        </p>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-3 min-h-[44px] rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? "در حال ذخیره…" : "ذخیره قالب"}
        </button>
      )}
    </div>
  );
}

export function SmsTemplatesForm({
  templates,
  canEdit,
}: {
  templates: SmsTemplateRow[];
  canEdit: boolean;
}) {
  if (templates.length === 0) {
    return (
      <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
        هنوز قالبی تعریف نشده.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {templates.map((t) => (
        <TemplateEditor key={t.eventKey} template={t} canEdit={canEdit} />
      ))}
    </div>
  );
}
