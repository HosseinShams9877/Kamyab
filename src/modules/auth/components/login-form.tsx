"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { z } from "zod";
// The schema is imported from the module's isomorphic leaf, not the "@/modules/auth"
// barrel: this is a client component, and the barrel aggregates server-only code
// (node:crypto sessions, bcrypt) that cannot enter a client bundle. Client
// components import a module's shared schema/types leaves directly; server code
// uses the index public API. (Documented in docs/roadmap/folder-structure.md.)
import { loginSchema } from "@/modules/auth/auth.schema";

// Client login form (C-1). Validation uses the SAME Zod schema the server uses,
// so the browser gives fast feedback while the server remains the real gate.
// User-facing text is Persian; the layout inherits RTL and Vazirmatn from the
// root layout and the design tokens from Tailwind.

type LoginValues = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        redirect?: string;
      };

      if (res.ok && data.ok && data.redirect) {
        // Full navigation so server components re-read the new session cookie.
        router.replace(data.redirect);
        router.refresh();
        return;
      }
      setFormError(data.message ?? "خطایی رخ داد. دوباره تلاش کنید.");
    } catch {
      setFormError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-control bg-error-bg px-4 py-3 text-sm text-error"
        >
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="mobile" className="mb-1.5 block text-sm font-medium text-text">
          شماره موبایل
        </label>
        <input
          id="mobile"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          dir="ltr"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-left text-text outline-none transition-colors focus:border-primary"
          {...register("mobile")}
        />
        {errors.mobile && (
          <p className="mt-1.5 text-sm text-error">{errors.mobile.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text">
          رمز عبور
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          className="w-full rounded-control border border-border bg-card px-3 py-2 text-left text-text outline-none transition-colors focus:border-primary"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1.5 text-sm text-error">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-[44px] w-full rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
      >
        {isSubmitting ? "در حال ورود…" : "ورود"}
      </button>
    </form>
  );
}
