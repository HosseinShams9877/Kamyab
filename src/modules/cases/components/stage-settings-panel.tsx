"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StageSettings } from "../cases.types";
import { PersianTextarea } from "@/components/ui/persian-textarea";
import { PersianInput } from "@/components/ui/persian-input";

const field =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary disabled:opacity-50";
const label = "mb-2 block text-sm font-medium text-text";

const NOTIFICATION_VARS = [
  "{stageTitle}",
  "{caseNumber}",
  "{customerName}",
  "{daysRemaining}",
  "{instituteName}",
] as const;

const SMS_VARS = [
  "{stageTitle}",
  "{caseNumber}",
  "{customerName}",
  "{daysRemaining}",
  "{instituteName}",
] as const;

export function StageSettingsPanel({
  initial,
  canEdit,
}: {
  initial: StageSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [s, setS] = useState<StageSettings>(initial);

  const working = busy || pending;

  function toggleChannel(c: StageSettings["channels"][number]) {
    setS((p) => ({
      ...p,
      channels: p.channels.includes(c)
        ? p.channels.filter((x) => x !== c)
        : [...p.channels, c],
    }));
  }

  function toggleRecipient(r: StageSettings["recipients"][number]) {
    setS((p) => ({
      ...p,
      recipients: p.recipients.includes(r)
        ? p.recipients.filter((x) => x !== r)
        : [...p.recipients, r],
    }));
  }

  function appendNotificationVar(v: string) {
    setS((p) => ({ ...p, notificationTemplate: p.notificationTemplate + " " + v }));
  }

  function appendSmsVar(v: string) {
    setS((p) => ({ ...p, smsTemplate: p.smsTemplate + " " + v }));
  }

  async function submit() {
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/stages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !d.ok) {
        setError(d.message ?? "ذخیره انجام نشد.");
        return;
      }
      setDone(true);
      startTransition(() => router.refresh());
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-control bg-success-bg px-4 py-3 text-sm text-success">
          تنظیمات ذخیره شد.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => setS({ ...s, enabled: e.target.checked })}
          disabled={!canEdit || working}
        />
        فعال‌سازی یادآور سررسید مراحل
      </label>

      <div>
        <label className={label}>چند روز قبل از سررسید پیام بره</label>
        <PersianInput
          inputMode="numeric"
          dir="rtl"
          value={String(s.daysBefore)}
          onChange={(v) => setS({ ...s, daysBefore: Number(v) || 0 })}
          disabled={!canEdit || working}
          className={field}
        />
        <p className="mt-1 text-xs text-text-secondary">
          پیام از این روز تا روز سررسید، هر روز (در صورت انجام نشدن مرحله) تکرار
          می‌شود.
        </p>
      </div>

      <div>
        <label className={label}>کانال‌های اطلاع‌رسانی</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.channels.includes("INTERNAL_NOTIFICATION")}
              onChange={() => toggleChannel("INTERNAL_NOTIFICATION")}
              disabled={!canEdit || working}
            />
            اعلان داخلی
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.channels.includes("SMS_TO_CUSTOMER")}
              onChange={() => toggleChannel("SMS_TO_CUSTOMER")}
              disabled={!canEdit || working}
            />
            پیامک به مشتری
          </label>
        </div>
      </div>

      <div>
        <label className={label}>دریافت‌کنندگان</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.recipients.includes("CASE_OWNER")}
              onChange={() => toggleRecipient("CASE_OWNER")}
              disabled={!canEdit || working}
            />
            مسئول پرونده
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.recipients.includes("ALL_MANAGERS")}
              onChange={() => toggleRecipient("ALL_MANAGERS")}
              disabled={!canEdit || working}
            />
            همهٔ مدیران
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={s.autoPrompt}
          onChange={(e) => setS({ ...s, autoPrompt: e.target.checked })}
          disabled={!canEdit || working}
        />
        پس از اتمام هر مرحله، دیالوگ تعیین سررسید مرحلهٔ بعد به‌صورت خودکار باز
        شود
      </label>

      <div>
        <label className={label}>متن اعلان داخلی</label>
        <PersianTextarea
          rows={3}
          value={s.notificationTemplate}
          onChange={(v) => setS({ ...s, notificationTemplate: v })}
          disabled={!canEdit || working}
          dir="rtl"
          className={field}
        />
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-text-secondary">
          <span>متغیرها:</span>
          {NOTIFICATION_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => appendNotificationVar(v)}
              disabled={!canEdit || working}
              className="rounded-control border border-border bg-page px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>متن پیامک</label>
        <PersianTextarea
          rows={3}
          value={s.smsTemplate}
          onChange={(v) => setS({ ...s, smsTemplate: v })}
          disabled={!canEdit || working}
          dir="rtl"
          className={field}
        />
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-text-secondary">
          <span>متغیرها:</span>
          {SMS_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => appendSmsVar(v)}
              disabled={!canEdit || working}
              className="rounded-control border border-border bg-page px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={submit}
          disabled={working}
          className="min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {working ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </button>
      )}
    </div>
  );
}