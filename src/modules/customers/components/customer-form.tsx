"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
// Isomorphic schema leaf import (documented client-component exception): the
// "@/modules/customers" barrel pulls in server-only code (Prisma).
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/modules/customers/customers.schema";
import type { CustomerDetail } from "@/modules/customers/customers.types";

// Create / edit a customer (C-3). The first choice is the type, and the rest of
// the form changes with it. The SAME Zod schema validates here and on the
// server, so the browser gives fast feedback while the API stays the real gate.

type Props =
  | { mode: "create" }
  | { mode: "edit"; customer: CustomerDetail };

type FormValues = {
  type: "NATURAL" | "LEGAL";
  fullName: string;
  companyName: string;
  mobile: string;
  nationalId: string;
  nationalEntityId: string;
  registrationNumber: string;
  birthDate: string;
  foundingDate: string;
  sendGreeting: boolean;
  landline: string;
  city: string;
  address: string;
  notes: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

function initialValues(props: Props): FormValues {
  const c = props.mode === "edit" ? props.customer : null;
  return {
    type: c?.type ?? "NATURAL",
    fullName: c?.fullName ?? "",
    companyName: c?.companyName ?? "",
    mobile: c?.mobile ?? "",
    nationalId: c?.nationalId ?? "",
    nationalEntityId: c?.nationalEntityId ?? "",
    registrationNumber: c?.registrationNumber ?? "",
    birthDate: c?.birthDate ?? "",
    foundingDate: c?.foundingDate ?? "",
    sendGreeting: c?.sendGreeting ?? true,
    landline: c?.landline ?? "",
    city: c?.city ?? "",
    address: c?.address ?? "",
    notes: c?.notes ?? "",
  };
}

export function CustomerForm(props: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = props.mode === "create" ? createCustomerSchema : updateCustomerSchema;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: initialValues(props),
  });

  const type = watch("type");
  const isNatural = type === "NATURAL";
  // The greeting checkbox is only meaningful once the type's date is filled.
  const dateForGreeting = isNatural ? watch("birthDate") : watch("foundingDate");
  const greetingEnabled = !!dateForGreeting && dateForGreeting.trim() !== "";

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const url =
      props.mode === "create"
        ? "/api/customers"
        : `/api/customers/${props.customer.id}`;
    const method = props.mode === "create" ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as {
        ok: boolean;
        id?: string;
        field?: string;
        message?: string;
      };
      if (res.ok && data.ok) {
        const id = props.mode === "create" ? data.id! : props.customer.id;
        router.push(`/customers/${id}`);
        router.refresh();
        return;
      }
      if (data.field === "mobile") {
        setError("mobile", { message: data.message });
      } else {
        setFormError(data.message ?? "خطایی رخ داد. دوباره تلاش کنید.");
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
      {/* Customer type — the first choice; the rest of the form follows it. */}
      <div>
        <label htmlFor="type" className={labelClass}>نوع مشتری</label>
        <select id="type" className={inputClass} {...register("type")}>
          <option value="NATURAL">حقیقی</option>
          <option value="LEGAL">حقوقی</option>
        </select>
      </div>

      {isNatural ? (
        <div>
          <label htmlFor="fullName" className={labelClass}>نام و نام خانوادگی</label>
          <input id="fullName" type="text" className={inputClass} {...register("fullName")} />
          {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
        </div>
      ) : (
        <div>
          <label htmlFor="companyName" className={labelClass}>نام شرکت</label>
          <input id="companyName" type="text" className={inputClass} {...register("companyName")} />
          {errors.companyName && <p className={errorClass}>{errors.companyName.message}</p>}
        </div>
      )}

      <div>
        <label htmlFor="mobile" className={labelClass}>شماره موبایل</label>
        <input
          id="mobile"
          type="text"
          inputMode="numeric"
          dir="ltr"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          className={`${inputClass} text-left`}
          {...register("mobile")}
        />
        {errors.mobile && <p className={errorClass}>{errors.mobile.message}</p>}
      </div>
      {isNatural ? (
        <>
          <div>
            <label htmlFor="nationalId" className={labelClass}>کد ملی (اختیاری)</label>
            <input
              id="nationalId"
              type="text"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} text-left`}
              {...register("nationalId")}
            />
            {errors.nationalId && <p className={errorClass}>{errors.nationalId.message}</p>}
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>تاریخ تولد (اختیاری)</label>
            <input
              id="birthDate"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="۱۳۷۰/۰۱/۰۱"
              className={`${inputClass} text-left`}
              {...register("birthDate")}
            />
            {errors.birthDate && <p className={errorClass}>{errors.birthDate.message}</p>}
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="nationalEntityId" className={labelClass}>شناسه ملی (اختیاری)</label>
            <input
              id="nationalEntityId"
              type="text"
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} text-left`}
              {...register("nationalEntityId")}
            />
            {errors.nationalEntityId && <p className={errorClass}>{errors.nationalEntityId.message}</p>}
          </div>
          <div>
            <label htmlFor="registrationNumber" className={labelClass}>شماره ثبت (اختیاری)</label>
            <input id="registrationNumber" type="text" className={inputClass} {...register("registrationNumber")} />
            {errors.registrationNumber && <p className={errorClass}>{errors.registrationNumber.message}</p>}
          </div>
          <div>
            <label htmlFor="foundingDate" className={labelClass}>تاریخ تأسیس (اختیاری)</label>
            <input
              id="foundingDate"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="۱۳۹۰/۰۱/۰۱"
              className={`${inputClass} text-left`}
              {...register("foundingDate")}
            />
            {errors.foundingDate && <p className={errorClass}>{errors.foundingDate.message}</p>}
          </div>
        </>
      )}
      {/* Greeting checkbox — only meaningful once the type's date is filled. */}
      <div>
        <label
          className={`flex items-center gap-2 text-sm ${
            greetingEnabled ? "text-text" : "text-disabled"
          }`}
        >
          <input
            type="checkbox"
            disabled={!greetingEnabled}
            className="h-4 w-4"
            {...register("sendGreeting")}
          />
          ارسال پیام تبریک
        </label>
        {!greetingEnabled && (
          <p className="mt-1.5 text-sm text-text-secondary">
            {isNatural
              ? "برای فعال شدن، تاریخ تولد را وارد کنید."
              : "برای فعال شدن، تاریخ تأسیس را وارد کنید."}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="landline" className={labelClass}>تلفن ثابت (اختیاری)</label>
        <input
          id="landline"
          type="text"
          inputMode="numeric"
          dir="ltr"
          className={`${inputClass} text-left`}
          {...register("landline")}
        />
        {errors.landline && <p className={errorClass}>{errors.landline.message}</p>}
      </div>

      <div>
        <label htmlFor="city" className={labelClass}>شهر (اختیاری)</label>
        <input id="city" type="text" className={inputClass} {...register("city")} />
        {errors.city && <p className={errorClass}>{errors.city.message}</p>}
      </div>

      <div>
        <label htmlFor="address" className={labelClass}>آدرس (اختیاری)</label>
        <textarea id="address" rows={2} className={inputClass} {...register("address")} />
        {errors.address && <p className={errorClass}>{errors.address.message}</p>}
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
        {isSubmitting
          ? "در حال ذخیره…"
          : props.mode === "create"
            ? "ثبت مشتری"
            : "ذخیره تغییرات"}
      </button>
    </form>
  );
}
