import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { Role } from "@/types/enums.schema";

// Shared validation for the employees domain (C-12). The SAME objects validate
// in the browser (React Hook Form) and on the server (the API routes), so a
// hand-crafted request cannot bypass a rule the form enforces. Field messages are
// Persian (user-facing); identifiers and comments stay English.

// Mobile is the username: 11 digits, Iranian format. Persian/Arabic digits are
// normalized to ASCII first so "۰۹۱۲۳۴۵۶۷۸۹" and "09123456789" are equivalent.
const mobile = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .pipe(
    z.string().regex(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست." }),
  );

const fullName = z
  .string()
  .trim()
  .min(2, { message: "نام باید حداقل ۲ نویسه باشد." })
  .max(100, { message: "نام حداکثر ۱۰۰ نویسه است." });

// Optional email. An empty string is treated as "not provided" (normalized to
// null in the service); a non-empty value must be a valid address.
const email = z
  .string()
  .trim()
  .email({ message: "ایمیل معتبر نیست." })
  .optional()
  .or(z.literal(""));

// Optional department id (cuid from the settings list). Empty string → none.
const departmentId = z.string().trim().min(1).optional().or(z.literal(""));

const password = z
  .string()
  .min(8, { message: "رمز عبور باید حداقل ۸ نویسه باشد." });

export const createEmployeeSchema = z.object({
  fullName,
  mobile,
  email,
  departmentId,
  role: Role,
  password,
});

// Profile update. NOTE: status is intentionally absent — deactivation must go
// through the guarded deactivation flow (successor transfer, last-manager and
// self guards) and reactivation through its own endpoint, so a plain profile
// edit can never flip status and skip those rules.
export const updateEmployeeSchema = z.object({
  fullName,
  mobile,
  email,
  departmentId,
  role: Role,
});

export const setPasswordSchema = z.object({ password });

// The permission matrix submits a desired value per key. Unknown keys are
// ignored and missing keys fall back to the role default (handled in the
// permissions module), so a partial record is accepted here.
export const permissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

// Deactivation may carry a successor to receive the departing employee's work.
export const deactivateSchema = z.object({
  successorId: z.string().trim().min(1).optional().or(z.literal("")),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type PermissionsInput = z.infer<typeof permissionsSchema>;
export type DeactivateInput = z.infer<typeof deactivateSchema>;
