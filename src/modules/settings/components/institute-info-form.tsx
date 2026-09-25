"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { instituteInfoSchema } from "@/modules/settings/settings.schema";
import type { InstituteInfo } from "@/modules/settings/settings.types";

// Institute information (B-10). The name here is the single source consumed by
// headings and the login page (rule 1: nothing hardcoded).

type FormValues = {
  name: string;
  phone: string;
  address: string;
  email: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

export function InstituteInfoForm({
  info,
  canEdit,
}: {
  info: InstituteInfo;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(instituteInfoSchema) as Resolver<FormValues>,
    defaultValues: {
      name: info.name,
      phone: info.phone,
      address: info.address,
      email: info.email,
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    try {
      const res = await fetch("/api/settings/institute", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as {
        ok: boolean;
        field?: string;
        message?: string;
      };
      if (res.ok && data.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      if (
        data.field === "name" ||
        data.field === "phone" ||
        data.field === "email"
      ) {
        setError(data.field as keyof FormValues, { message: data.message });
      } else {
        setFormError(data.message ?? "خطایی رخ داد.");
      }
    } catch {
      setFormError("ارتباط با سرور برقرار نشد.");
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
          اطلاعات موسسه ذخیره شد.
        </div>
      )}

      <div>
        <label htmlFor="inst-name" className={labelClass}>نام موسسه</label>
        <input id="inst-name" type="text" className={inputClass} disabled={!canEdit} {...register("name")} />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="inst-phone" className={labelClass}>تلفن</label>
        <input id="inst-phone" type="text" inputMode="numeric" dir="ltr" className={`${inputClass} text-left`} disabled={!canEdit} {...register("phone")} />
        {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
      </div>

      <div>
        <label htmlFor="inst-address" className={labelClass}>آدرس (اختیاری)</label>
        <textarea id="inst-address" rows={2} className={inputClass} disabled={!canEdit} {...register("address")} />
        {errors.address && <p className={errorClass}>{errors.address.message}</p>}
      </div>

      <div>
        <label htmlFor="inst-email" className={labelClass}>ایمیل (اختیاری)</label>
        <input id="inst-email" type="text" dir="ltr" className={`${inputClass} text-left`} disabled={!canEdit} {...register("email")} />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      {canEdit && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
        >
          {isSubmitting ? "در حال ذخیره…" : "ذخیره اطلاعات موسسه"}
        </button>
      )}
    </form>
  );
}
