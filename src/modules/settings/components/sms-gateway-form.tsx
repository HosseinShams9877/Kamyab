"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { smsGatewaySchema } from "@/modules/settings/settings.schema";
import type { GatewayView } from "@/modules/settings/settings.types";
import { SMS_PROVIDERS } from "../lib/labels";

// SMS gateway (B-10). The API key is write-only: the server never echoes it, so
// the field starts blank and a blank submission keeps the stored key. Real-send
// is the safety switch — when off, messages are built and recorded but not sent.
// "Test connection" checks configuration completeness (no message is sent yet;
// real delivery is the Phase 15 engine's job).

type FormValues = {
  provider: string;
  senderNumber: string;
  realSend: boolean;
  apiKey: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

export function SmsGatewayForm({
  gateway,
  canEdit,
}: {
  gateway: GatewayView;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(smsGatewaySchema) as Resolver<FormValues>,
    defaultValues: {
      provider: gateway.provider,
      senderNumber: gateway.senderNumber,
      realSend: gateway.realSend,
      apiKey: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    try {
      const res = await fetch("/api/settings/sms-gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (res.ok && data.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      setFormError(data.message ?? "خطایی رخ داد.");
    } catch {
      setFormError("ارتباط با سرور برقرار نشد.");
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/settings/sms-gateway/test", {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      setTestMsg({ ok: data.ok, text: data.message ?? "" });
    } catch {
      setTestMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {formError}
        </div>
      )}
      {done && (
        <div className="rounded-control bg-success-bg px-4 py-3 text-sm text-success">
          تنظیمات سامانه پیامک ذخیره شد.
        </div>
      )}

      <div>
        <label htmlFor="gw-provider" className={labelClass}>سامانه پیامک</label>
        <select id="gw-provider" className={inputClass} disabled={!canEdit} {...register("provider")}>
          <option value="">— انتخاب سامانه —</option>
          {SMS_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {errors.provider && <p className={errorClass}>{errors.provider.message}</p>}
      </div>

      <div>
        <label htmlFor="gw-sender" className={labelClass}>شماره فرستنده</label>
        <input id="gw-sender" type="text" dir="ltr" className={`${inputClass} text-left`} disabled={!canEdit} {...register("senderNumber")} />
        {errors.senderNumber && <p className={errorClass}>{errors.senderNumber.message}</p>}
      </div>

      <div>
        <label htmlFor="gw-key" className={labelClass}>کلید API</label>
        <input
          id="gw-key"
          type="password"
          dir="ltr"
          autoComplete="off"
          placeholder={gateway.hasApiKey ? "••••••••  (برای تغییر، کلید جدید را وارد کنید)" : "کلید API را وارد کنید"}
          className={`${inputClass} text-left`}
          disabled={!canEdit}
          {...register("apiKey")}
        />
        {errors.apiKey && <p className={errorClass}>{errors.apiKey.message}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" disabled={!canEdit} {...register("realSend")} />
        ارسال واقعی پیامک فعال باشد (در صورت خاموش‌بودن، پیام‌ها ساخته و ثبت می‌شوند ولی ارسال نمی‌شوند)
      </label>

      {testMsg && (
        <p className={`text-sm ${testMsg.ok ? "text-success" : "text-error"}`}>
          {testMsg.text}
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
          >
            {isSubmitting ? "در حال ذخیره…" : "ذخیره سامانه پیامک"}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="rounded-control border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-page disabled:opacity-50"
          >
            {testing ? "در حال بررسی…" : "تست اتصال"}
          </button>
        </div>
      )}
    </form>
  );
}
