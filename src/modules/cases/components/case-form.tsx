"use client";

import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
// Isomorphic leaf imports (documented client-component exception): the
// "@/modules/cases" barrel pulls in server-only code (Prisma).
import { caseCreateSchema } from "@/modules/cases/cases.schema";
import type { CaseFormData, ServiceCaseMeta } from "@/modules/cases/cases.types";
import { stageCountHint } from "@/modules/cases/lib/labels";
import { parseJalali, addMonths, formatJalali } from "@/lib/jalali";

// Register a new case (C-4). The form is live: picking a customer that lacks a
// birth/founding date reveals those fields; picking a service loads its stage
// count + validity durations and, only when the service is renewable, shows the
// duration + a computed expiry preview. The SAME Zod schema validates here and
// on the server, so the API stays the real gate. Expiry math uses the shared
// Jalali helper (calendar months, day clamped) — the server recomputes it on save.

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

// PLACEHOLDER_BODY

export function CaseForm({ data }: { data: CaseFormData }) {
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
  const durationId = watch("durationId");
  const startDate = watch("startDate");

  const selectedCustomer = data.customers.find((c) => c.id === customerId) ?? null;
  // Birth/founding fields appear only when the picked customer still lacks them.
  const needsBirthInfo = !!selectedCustomer && !selectedCustomer.hasBirthInfo;
  const isNatural = selectedCustomer?.type === "NATURAL";

  // Seed the greeting flag from the picked customer so a case for a customer who
  // already has their date does not overwrite their existing greeting preference.
  useEffect(() => {
    if (selectedCustomer) setValue("sendGreeting", selectedCustomer.sendGreeting);
  }, [selectedCustomer, setValue]);
  // PLACEHOLDER_EFFECTS

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
        // Preselect the default duration for a renewable service, if any.
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
        router.push(`/cases/${body.id}`);
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
  // PLACEHOLDER_JSX
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="customerId" className={labelClass}>مشتری</label>
        <select id="customerId" className={inputClass} {...register("customerId")}>
          <option value="">— انتخاب مشتری —</option>
          {data.customers.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName}</option>
          ))}
        </select>
        {errors.customerId && <p className={errorClass}>{errors.customerId.message}</p>}
      </div>

      {/* Birth/founding date + greeting — revealed only when the customer lacks it. */}
      {needsBirthInfo && (
        <div className="space-y-4 rounded-control border border-border bg-page p-4">
          <p className="text-sm text-text-secondary">
            {isNatural
              ? "برای این مشتری تاریخ تولد ثبت نشده است؛ در صورت تمایل وارد کنید."
              : "برای این مشتری تاریخ تأسیس ثبت نشده است؛ در صورت تمایل وارد کنید."}
          </p>
          <div>
            <label htmlFor="birthInfo" className={labelClass}>
              {isNatural ? "تاریخ تولد" : "تاریخ تأسیس"}
            </label>
            <input
              id="birthInfo"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder={isNatural ? "۱۳۷۰/۰۱/۰۱" : "۱۳۹۰/۰۱/۰۱"}
              className={`${inputClass} text-left`}
              {...register(isNatural ? "birthDate" : "foundingDate")}
            />
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
      {/* PLACEHOLDER_JSX_B */}
      <div>
        <label htmlFor="serviceId" className={labelClass}>خدمت</label>
        <select id="serviceId" className={inputClass} {...register("serviceId")}>
          <option value="">— انتخاب خدمت —</option>
          {data.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.serviceId && <p className={errorClass}>{errors.serviceId.message}</p>}
        {metaLoading && <p className={hintClass}>در حال بارگذاری…</p>}
        {meta && !metaLoading && <p className={hintClass}>{stageCountHint(meta.stageCount)}</p>}
      </div>

      <div>
        <label htmlFor="ownerId" className={labelClass}>مسئول پرونده</label>
        <select id="ownerId" className={inputClass} {...register("ownerId")}>
          <option value="">— انتخاب مسئول —</option>
          {data.owners.map((o) => (
            <option key={o.id} value={o.id}>{o.fullName}</option>
          ))}
        </select>
        {errors.ownerId && <p className={errorClass}>{errors.ownerId.message}</p>}
      </div>

      <div>
        <label htmlFor="startDate" className={labelClass}>تاریخ شروع</label>
        <input
          id="startDate"
          type="text"
          inputMode="numeric"
          dir="ltr"
          placeholder="۱۴۰۴/۰۱/۰۱"
          className={`${inputClass} text-left`}
          {...register("startDate")}
        />
        {errors.startDate && <p className={errorClass}>{errors.startDate.message}</p>}
      </div>

      {/* Duration + computed expiry — only for a renewable service (B-3). */}
      {meta?.renewable && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="durationId" className={labelClass}>مدت اعتبار</label>
            <select id="durationId" className={inputClass} {...register("durationId")}>
              <option value="">— انتخاب مدت —</option>
              {meta.durations.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
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
        <label htmlFor="totalAmount" className={labelClass}>مبلغ کل به تومان (اختیاری)</label>
        <input
          id="totalAmount"
          type="text"
          inputMode="numeric"
          dir="ltr"
          className={`${inputClass} text-left`}
          {...register("totalAmount")}
        />
        {errors.totalAmount && <p className={errorClass}>{errors.totalAmount.message}</p>}
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>توضیحات (اختیاری)</label>
        <textarea id="notes" rows={3} className={inputClass} {...register("notes")} />
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




