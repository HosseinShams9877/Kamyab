import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali, isFutureJalali } from "@/lib/jalali";
import { CustomerType } from "@/types/enums.schema";
import { isValidNationalId } from "./customers.guards";

// Shared validation for the customers domain (C-3).

const mobile = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .pipe(z.string().regex(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست." }));

function optionalText(max: number, message?: string) {
  return z
    .string()
    .trim()
    .max(max, { message: message ?? `حداکثر ${max} نویسه مجاز است.` })
    .optional()
    .or(z.literal(""));
}

function optionalJalaliNotFuture(message: string) {
  return z
    .string()
    .transform((v) => toEnglishDigits(v.trim()))
    .refine((v) => v === "" || parseJalali(v) !== null, {
      message: "تاریخ معتبر نیست.",
    })
    .refine(
      (v) => {
        if (v === "") return true;
        const j = parseJalali(v);
        return j !== null && !isFutureJalali(j);
      },
      { message },
    );
}

const nationalId = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || isValidNationalId(v), {
    message: "کد ملی معتبر نیست.",
  });

const nationalEntityId = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || /^\d{11}$/.test(v), {
    message: "شناسه ملی باید ۱۱ رقم باشد.",
  });

const landline = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || /^\d{1,15}$/.test(v), {
    message: "شماره ثابت معتبر نیست.",
  });

const base = z.object({
  type: CustomerType,
  fullName: optionalText(100),
  companyName: optionalText(150),
  mobile,
  nationalId,
  nationalEntityId,
  registrationNumber: optionalText(20),
  birthDate: optionalJalaliNotFuture("تاریخ تولد نمی‌تواند در آینده باشد."),
  foundingDate: optionalJalaliNotFuture("تاریخ تأسیس نمی‌تواند در آینده باشد."),
  sendGreeting: z.boolean(),
  landline,
  city: optionalText(100),
  address: optionalText(500),
  notes: optionalText(1000),
});

function refineByType(val: z.infer<typeof base>, ctx: z.RefinementCtx): void {
  if (val.type === "NATURAL") {
    const name = (val.fullName ?? "").trim();
    if (name.length < 2 || name.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fullName"],
        message: "نام باید بین ۲ تا ۱۰۰ نویسه باشد.",
      });
    }
  } else {
    const name = (val.companyName ?? "").trim();
    if (name.length < 2 || name.length > 150) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "نام شرکت باید بین ۲ تا ۱۵۰ نویسه باشد.",
      });
    }
  }
}

export const createCustomerSchema = base.superRefine(refineByType);
export const updateCustomerSchema = base.superRefine(refineByType);

export const setCustomerStatusSchema = z.object({ status: z.boolean() });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type SetCustomerStatusInput = z.infer<typeof setCustomerStatusSchema>;