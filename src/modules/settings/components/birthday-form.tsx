"use client";

import { useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { birthdaySchema } from "@/modules/settings/settings.schema";
import type { BirthdaySettings } from "@/modules/settings/settings.types";
import { PersianInput } from "@/components/ui/persian-input";

// Birthday greeting (B-9). Master switch (default OFF) + send hour (0–23,
// default 10). The two greeting texts (natural person / legal entity) are edited
// in the "SMS templates" section as the birthday_natural / birthday_legal
// templates — kept in one place so a single editor owns each template row.

type FormValues = { enabled: boolean; sendHour: string };

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary sm:w-32";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

export function BirthdayForm({
  birthday,
  canEdit,
}: {
  birthday: BirthdaySettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(birthdaySchema) as Resolver<FormValues>,
    defaultValues: {
      enabled: birthday.enabled,
      sendHour: String(birthday.sendHour),
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    try {
      const res = await fetch("/api/settings/birthday", {
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {formError && (
        <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {formError}
        </div>
      )}
      {done && (
        <div className="rounded-control bg-success-bg px-4 py-3 text-sm text-success">
          تنظیمات تبریک تولد ذخیره شد.
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" disabled={!canEdit} {...register("enabled")} />
        ارسال خودکار پیام تبریک تولد فعال باشد
      </label>

      <div>
        <label htmlFor="birthday-hour" className={labelClass}>ساعت ارسال (۰ تا ۲۳)</label>
        <Controller
          name="sendHour"
          control={control}
          render={({ field }) => (
            <PersianInput
              id="birthday-hour"
              dir="ltr"
              inputMode="numeric"
              className={`${inputClass} text-right`}
              disabled={!canEdit}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.sendHour && <p className={errorClass}>{errors.sendHour.message}</p>}
      </div>

      <p className="rounded-control bg-info-bg px-4 py-3 text-xs text-info">
        متن پیام تبریک برای اشخاص حقیقی و حقوقی در بخش «قالب‌های پیامک» (رویدادهای
        «تبریک تولد») ویرایش می‌شود.
      </p>

      {canEdit && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
        >
          {isSubmitting ? "در حال ذخیره…" : "ذخیره تنظیمات تولد"}
        </button>
      )}
    </form>
  );
}