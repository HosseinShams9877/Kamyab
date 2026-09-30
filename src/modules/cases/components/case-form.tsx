"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception): the
// "@/modules/cases" barrel pulls in server-only code (Prisma).
import { caseCreateSchema } from "@/modules/cases/cases.schema";
import type { CaseFormData, ServiceCaseMeta } from "@/modules/cases/cases.types";
import { stageCountHint } from "@/modules/cases/lib/labels";
import { parseJalali, addMonths, formatJalali } from "@/lib/jalali";
import { toEnglishDigits } from "@/lib/digits";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { PersianInput } from "@/components/ui/persian-input";

// Register a new case (C-4). The form is live: picking a customer that lacks a
// birth/founding date reveals those fields; picking a service loads its stage
// count + validity durations and, only when the service is renewable, shows the
// duration + a computed expiry preview. The SAME Zod schema validates here and
// on the server, so the API stays the real gate. Expiry math uses the shared
// Jalali helper (calendar months, day clamped) — the server recomputes it on save.
//
// The four pick fields (customer, service, owner, duration) use the shared
// SearchableSelect; the three date fields use the shared JalaliDatePicker; the
// numeric amount uses PersianInput (Persian glyphs, LTR, ASCII stored).
//
// `basePath` decides where the user lands after a successful save: the manager
// form uses the default /cases, the employee form passes /employee/cases so
// navigation stays inside the employee shell.

type FormValues = {
  customerId: string;
  serviceId: string;
  ownerId: string;
  durationId: string;
  startDate: string;
  totalAmount: string;
  notes: string;
  birthDate: string;
  foundingDate: string;
  sendGreeting: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";
const hintClass = "mt-1.5 text-sm text-text-secondary";

/** Client-side expiry preview: start (Jalali) + N months, day clamped. */
function previewExpiry(start: string, monthCount: number): string | null {
  const j = parseJalali(start);
  if (!j) return null;
  return formatJalali(addMonths(j, monthCount), { persianDigits: true });
}

export function CaseForm({
  data,
  basePath = "/cases",
}: {
  data: CaseFormData;
  basePath?: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ServiceCaseMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(caseCreateSchema) as Resolver<FormValues>,
    defaultValues: {
      customerId: data.presetCustomerId ?? "",
      serviceId: "",
      ownerId: "",
      durationId: "",
      startDate: "",
      totalAmount: "",
      notes: "",
      birthDate: "",
      foundingDate: "",
      sendGreeting: false,
    },
  });

  const customerId = watch("customerId");
  const serviceId = watch("serviceId");
  const ownerId = watch("ownerId");
  const durationId = watch("durationId");
  const startDate = watch("startDate");
  const birthDate = watch("birthDate");
  const foundingDate = watch("foundingDate");

  const selectedCustomer = data.customers.find((c) => c.id === customerId) ?? null;
  const needsBirthInfo = !!selectedCustomer && !selectedCustomer.hasBirthInfo;
  const isNatural = selectedCustomer?.type === "NATURAL";

  // Seed the greeting flag from the picked customer so a case for a customer who
  // already has their date does not overwrite their existing greeting preference.
  useEffect(() => {
    if (selectedCustomer) setValue("sendGreeting", selectedCustomer.sendGreeting);
  }, [selectedCustomer, setValue]);

  // Load the picked service's meta (renewable, stage count, active durations).
  // Resetting duration on every service change avoids carrying a stale pick.
  useEffect(() => {
    setValue("durationId", "");
    if (!serviceId) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    setMetaLoading(true);
    fetch(`/api/cases/service-meta?serviceId=${encodeURIComponent(serviceId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ok: boolean; meta: ServiceCaseMeta } | null) => {
        if (cancelled) return;
        const next = body?.ok ? body.meta : null;
        setMeta(next);
        const preset = next?.durations.find((d) => d.isDefault) ?? next?.durations[0];
        if (next?.renewable && preset) setValue("durationId", preset.id);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, setValue]);

  const selectedDuration = meta?.durations.find((d) => d.id === durationId) ?? null;
  const expiryPreview =
    meta?.renewable && selectedDuration && startDate
      ? previewExpiry(startDate, selectedDuration.monthCount)
      : null;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json()) as {
        ok: boolean;
        id?: string;
        field?: string;
        message?: string;
      };
      if (res.ok && body.ok && body.id) {
        router.push(`${basePath}/${body.id}`);
        router.refresh();
        return;
      }
      const field = body.field;
      if (field && field in values) {
        setError(field as keyof FormValues, { message: body.message });
      } else {
        setFormError(body.message ?? "خطایی رخ داد. دوباره تلاش کنید.");
      }
    } catch {
      setFormError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {formError}
        </div>
      )}

      <div>
        <label className={labelClass}>مشتری</label>
        <SearchableSelect
          value={customerId}
          onChange={(v) => setValue("customerId", v, { shouldValidate: true })}
          options={data.customers.map((c) => ({ value: c.id, label: c.displayName }))}
          placeholder="— انتخاب مشتری —"
          normalizeQuery={toEnglishDigits}
        />
        {errors.customerId && <p className={errorClass}>{errors.customerId.message}</p>}
      </div>

      {needsBirthInfo && (
        <div className="space-y-4 rounded-control border border-border bg-page p-4">
          <p className="text-sm text-text-secondary">
            {isNatural
              ? "برای این مشتری تاریخ تولد ثبت نشده است؛ در صورت تمایل وارد کنید."
              : "برای این مشتری تاریخ تأسیس ثبت نشده است؛ در صورت تمایل وارد کنید."}
          </p>
          <div>
            <label className={labelClass}>
              {isNatural ? "تاریخ تولد" : "تاریخ تأسیس"}
            </label>
            {isNatural ? (
              <JalaliDatePicker
                value={birthDate}
                onChange={(v) => setValue("birthDate", v, { shouldValidate: true })}
                maxToday
                placeholder="۱۳۷۰/۰۱/۰۱"
              />
            ) : (
              <JalaliDatePicker
                value={foundingDate}
                onChange={(v) => setValue("foundingDate", v, { shouldValidate: true })}
                maxToday
                placeholder="۱۳۹۰/۰۱/۰۱"
              />
            )}
            {isNatural && errors.birthDate && (
              <p className={errorClass}>{errors.birthDate.message}</p>
            )}
            {!isNatural && errors.foundingDate && (
              <p className={errorClass}>{errors.foundingDate.message}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" className="h-4 w-4" {...register("sendGreeting")} />
            ارسال پیام تبریک
          </label>
        </div>
      )}

      <div>
        <label className={labelClass}>خدمت</label>
        <SearchableSelect
          value={serviceId}
          onChange={(v) => setValue("serviceId", v, { shouldValidate: true })}
          options={data.services.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="— انتخاب خدمت —"
        />
        {errors.serviceId && <p className={errorClass}>{errors.serviceId.message}</p>}
        {metaLoading && <p className={hintClass}>در حال بارگذاری…</p>}
        {meta && !metaLoading && <p className={hintClass}>{stageCountHint(meta.stageCount)}</p>}
      </div>

      <div>
        <label className={labelClass}>مسئول پرونده</label>
        <SearchableSelect
          value={ownerId}
          onChange={(v) => setValue("ownerId", v, { shouldValidate: true })}
          options={data.owners.map((o) => ({ value: o.id, label: o.fullName }))}
          placeholder="— انتخاب مسئول —"
        />
        {errors.ownerId && <p className={errorClass}>{errors.ownerId.message}</p>}
      </div>

      <div>
        <label className={labelClass}>تاریخ شروع</label>
        <JalaliDatePicker
          value={startDate}
          onChange={(v) => setValue("startDate", v, { shouldValidate: true })}
          maxToday
          placeholder="۱۴۰۴/۰۱/۰۱"
        />
        {errors.startDate && <p className={errorClass}>{errors.startDate.message}</p>}
      </div>

      {meta?.renewable && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>مدت اعتبار</label>
            <SearchableSelect
              value={durationId}
              onChange={(v) => setValue("durationId", v, { shouldValidate: true })}
              options={meta.durations.map((d) => ({ value: d.id, label: d.title }))}
              placeholder="— انتخاب مدت —"
            />
            {meta.durations.length === 0 && (
              <p className={errorClass}>برای این خدمت مدت اعتباری تعریف نشده است.</p>
            )}
            {errors.durationId && <p className={errorClass}>{errors.durationId.message}</p>}
          </div>
          <div>
            <label htmlFor="expiryPreview" className={labelClass}>تاریخ انقضا</label>
            <input
              id="expiryPreview"
              type="text"
              readOnly
              dir="ltr"
              value={expiryPreview ?? "—"}
              className={`${inputClass} bg-page text-left text-text-secondary`}
            />
            <p className={hintClass}>بر اساس تاریخ شروع و مدت اعتبار محاسبه می‌شود.</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="totalAmount" className={labelClass}>
          مبلغ کل به تومان (اختیاری)
        </label>
        <Controller
          name="totalAmount"
          control={control}
          render={({ field }) => (
            <PersianInput
              id="totalAmount"
              dir="ltr"
              inputMode="numeric"
              className={`${inputClass} text-right`}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.totalAmount && <p className={errorClass}>{errors.totalAmount.message}</p>}
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>توضیحات (اختیاری)</label>
        <textarea
          id="notes"
          rows={3}
          dir="rtl"
          className={inputClass}
          {...register("notes")}
        />
        {errors.notes && <p className={errorClass}>{errors.notes.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
      >
        {isSubmitting ? "در حال ثبت…" : "ثبت پرونده"}
      </button>
    </form>
  );
}