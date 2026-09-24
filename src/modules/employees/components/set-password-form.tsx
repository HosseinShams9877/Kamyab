"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setPasswordSchema } from "@/modules/employees/employees.schema";

// Set a new password for an employee (C-12). The manager can only SET a new
// value; the current password is never shown (it is a one-way hash server-side).

type Values = { password: string };

export function SetPasswordForm({ employeeId }: { employeeId: string }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: Values) {
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        reset({ password: "" });
        setMessage({ ok: true, text: "رمز عبور جدید ثبت شد." });
      } else {
        setMessage({ ok: false, text: "ثبت رمز عبور ناموفق بود." });
      }
    } catch {
      setMessage({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-text">
          رمز عبور جدید
        </label>
        <input
          id="new-password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-left text-text outline-none transition-colors focus:border-primary"
          {...register("password")}
        />
        {errors.password && <p className="mt-1.5 text-sm text-error">{errors.password.message}</p>}
      </div>
      {message && (
        <p className={`text-sm ${message.ok ? "text-primary" : "text-error"}`}>{message.text}</p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
      >
        {isSubmitting ? "در حال ثبت…" : "تغییر رمز عبور"}
      </button>
    </form>
  );
}
