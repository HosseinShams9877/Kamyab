"use client";

import { useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { thresholdsSchema } from "@/modules/settings/settings.schema";
import type { Thresholds } from "@/modules/settings/settings.types";
import { PersianInput } from "@/components/ui/persian-input";

// Time thresholds (B-8). Each field has explanatory text; zero is rejected by
// the schema (min 1). Values may be typed with Persian digits — normalized
// server- and client-side before validation.

type FormValues = {
  archiveDays: string;
  abandonmentDays: string;
  staleDays: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary sm:w-40";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const hintClass = "mt-1 text-xs text-text-secondary";
const errorClass = "mt-1.5 text-sm text-error";

const FIELDS: {
  name: keyof FormValues;
  label: string;
  hint: string;
}[] = [
  {
    name: "archiveDays",
    label: "بایگانی خودکار کارهای تکمیل‌شده (روز)",
    hint: "کارهای تکمیل‌شده پس از این تعداد روز به‌صورت خودکار بایگانی می‌شوند. (۱ تا ۳۶۵)",
  },
  {
    name: "abandonmentDays",
    label: "رهاشدن دوره منقضی بدون پیگیری (روز)",
    hint: "دوره‌های منقضی که پیگیری نشده‌اند، پس از این تعداد روز رهاشده در نظر گرفته می‌شوند. (۱ تا ۳۶۵)",
  },
  {
    name: "staleDays",
    label: "راکد شدن پرونده بدون فعالیت (روز)",
    hint: "پرونده‌ای که این تعداد روز هیچ فعالیتی نداشته باشد، راکد علامت‌گذاری می‌شود. (۱ تا ۱۸۰)",
  },
];

export function ThresholdsForm({
  thresholds,
  canEdit,
}: {
  thresholds: Thresholds;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(thresholdsSchema) as Resolver<FormValues>,
    defaultValues: {
      archiveDays: String(thresholds.archiveDays),
      abandonmentDays: String(thresholds.abandonmentDays),
      staleDays: String(thresholds.staleDays),
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    try {
      const res = await fetch("/api/settings/thresholds", {
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
          آستانه‌های زمانی ذخیره شد.
        </div>
      )}

      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className={labelClass}>{f.label}</label>
         <Controller
  name={f.name}
  control={control}
  render={({ field }) => (
    <PersianInput
      id={f.name}
      dir="rtl"
      inputMode="numeric"
      className={`${inputClass} text-right`}
      disabled={!canEdit}
      value={field.value}
      onChange={field.onChange}
    />
  )}
/>
          <p className={hintClass}>{f.hint}</p>
          {errors[f.name] && <p className={errorClass}>{errors[f.name]?.message}</p>}
        </div>
      ))}

      {canEdit && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
        >
          {isSubmitting ? "در حال ذخیره…" : "ذخیره آستانه‌ها"}
        </button>
      )}
    </form>
  );
}