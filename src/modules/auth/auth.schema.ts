import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";

// Shared login schema (C-1). The SAME object validates in the browser (React
// Hook Form) and on the server (the login route). Field messages are Persian
// because they are user-facing; identifiers and comments stay English.
//
// Note: these field-level messages describe the FORMAT of the input only. They
// never reveal whether a mobile is registered — that distinction is collapsed
// into a single generic message by the credential check (see auth.service.ts).

// Users may type Persian/Arabic-Indic digits; normalize to ASCII before the
// pattern check so "۰۹۱۲۳۴۵۶۷۸۹" validates the same as "09123456789".
const mobile = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .pipe(
    z
      .string()
      .regex(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست." }),
  );

const password = z
  .string()
  .min(8, { message: "رمز عبور را وارد کنید." });

export const loginSchema = z.object({
  mobile,
  password,
});

export type LoginInput = z.infer<typeof loginSchema>;
