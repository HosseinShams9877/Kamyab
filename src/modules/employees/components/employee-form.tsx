"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
// Isomorphic schema leaf import (documented client-component exception): the
// "@/modules/employees" barrel pulls in server-only code (bcrypt, Prisma).
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "@/modules/employees/employees.schema";
import type { DepartmentOption, EmployeeDetail } from "@/modules/employees/employees.types";
import { ROLE_LABELS } from "../lib/permission-labels";

// Create / edit an employee (C-12). The SAME Zod schema validates here and on the
// server, so the browser gives fast feedback while the API stays the real gate.

type Props =
  | { mode: "create"; departments: DepartmentOption[] }
  | { mode: "edit"; departments: DepartmentOption[]; employee: EmployeeDetail };

type FormValues = {
  fullName: string;
  mobile: string;
  email: string;
  departmentId: string;
  role: "MANAGER" | "SUPERVISOR" | "EMPLOYEE" | "";
  password: string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

export function EmployeeForm(props: Props) {
  const { mode, departments } = props;
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const schema = mode === "create" ? createEmployeeSchema : updateEmployeeSchema;
  const initial = mode === "edit" ? props.employee : undefined;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      fullName: initial?.fullName ?? "",
      mobile: initial?.mobile ?? "",
      email: initial?.email ?? "",
      departmentId: initial?.departmentId ?? "",
      role: initial?.role ?? "",
      password: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    const url = mode === "create" ? "/api/employees" : `/api/employees/${props.employee!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body =
      mode === "create"
        ? {
            fullName: values.fullName,
            mobile: values.mobile,
            email: values.email,
            departmentId: values.departmentId,
            role: values.role,
            password: values.password,
          }
        : {
            fullName: values.fullName,
            mobile: values.mobile,
            email: values.email,
            departmentId: values.departmentId,
            role: values.role,
          };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; field?: string; message?: string };
      if (res.ok && data.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      // Map a server field error (e.g. duplicate mobile) back onto the field.
      if (data.field === "mobile" || data.field === "departmentId") {
        setError(data.field, { message: data.message });
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
      {done && (
        <div className="rounded-control bg-page px-4 py-3 text-sm text-primary">
          {mode === "create" ? "کارمند ایجاد شد." : "تغییرات ذخیره شد."}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className={labelClass}>نام و نام خانوادگی</label>
        <input id="fullName" type="text" className={inputClass} {...register("fullName")} />
        {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
      </div>

      <div>
        <label htmlFor="mobile" className={labelClass}>شماره موبایل (نام کاربری)</label>
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

      <div>
        <label htmlFor="email" className={labelClass}>ایمیل (اختیاری)</label>
        <input id="email" type="text" dir="ltr" className={`${inputClass} text-left`} {...register("email")} />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="departmentId" className={labelClass}>دپارتمان (اختیاری)</label>
        <select id="departmentId" className={inputClass} {...register("departmentId")}>
          <option value="">— بدون دپارتمان —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        {errors.departmentId && <p className={errorClass}>{errors.departmentId.message}</p>}
      </div>

      <div>
        <label htmlFor="role" className={labelClass}>نقش</label>
        <select id="role" className={inputClass} {...register("role")}>
          <option value="">— انتخاب نقش —</option>
          <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
          <option value="SUPERVISOR">{ROLE_LABELS.SUPERVISOR}</option>
          <option value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</option>
        </select>
        {errors.role && <p className={errorClass}>{errors.role.message}</p>}
      </div>

      {mode === "create" && (
        <div>
          <label htmlFor="password" className={labelClass}>رمز عبور اولیه</label>
          <input id="password" type="password" dir="ltr" autoComplete="new-password" className={`${inputClass} text-left`} {...register("password")} />
          {errors.password && <p className={errorClass}>{errors.password.message}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
      >
        {isSubmitting ? "در حال ذخیره…" : mode === "create" ? "ایجاد کارمند" : "ذخیره تغییرات"}
      </button>
    </form>
  );
}