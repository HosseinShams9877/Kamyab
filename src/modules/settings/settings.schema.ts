// Isomorphic Zod schemas for the settings domain (C-13). Safe on client and
// server: pure Zod + the shared digit helpers, no server-only imports. Numeric
// fields are normalized from Persian to English digits first (a manager may
// type either), then coerced. Ranges follow 04-manager-defined.md B-8/B-9/B-10.

import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { RenewalEffect as renewalEffectSchema } from "@/types/enums.schema";

/** Normalize an incoming numeric string/number to English digits, trimmed. */
const numericInput = z
  .union([z.string(), z.number()])
  .transform((v) => toEnglishDigits(String(v)).trim());

/** A managed-list title: 2–60 chars after trimming (B-5/B-6/B-7). */
export const listTitleSchema = z
  .string()
  .trim()
  .min(2, "عنوان باید حداقل ۲ نویسه باشد.")
  .max(60, "عنوان نباید بیش از ۶۰ نویسه باشد.");

// ---------------------------------------------------------------------------
// Managed lists (B-5, B-6, B-7)
// ---------------------------------------------------------------------------

export const listCreateSchema = z.object({
  title: listTitleSchema,
  // Only meaningful for follow-up results; ignored for other kinds.
  effectOnRenewal: renewalEffectSchema.optional(),
});
export type ListCreateInput = z.infer<typeof listCreateSchema>;

export const listUpdateSchema = z
  .object({
    title: listTitleSchema.optional(),
    active: z.boolean().optional(),
    effectOnRenewal: renewalEffectSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });
export type ListUpdateInput = z.infer<typeof listUpdateSchema>;

export const listMoveSchema = z.object({
  direction: z.enum(["up", "down"]),
});
export type ListMoveInput = z.infer<typeof listMoveSchema>;

// ---------------------------------------------------------------------------
// Institute information (B-10)
// ---------------------------------------------------------------------------

export const instituteInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام موسسه باید حداقل ۲ نویسه باشد.")
    .max(120, "نام موسسه نباید بیش از ۱۲۰ نویسه باشد."),
  phone: z
    .string()
    .trim()
    .transform((v) => toEnglishDigits(v))
    .pipe(
      z
        .string()
        .regex(/^0\d{9,10}$/, "شماره تماس معتبر نیست."),
    ),
  address: z
    .string()
    .trim()
    .max(300, "آدرس نباید بیش از ۳۰۰ نویسه باشد.")
    .optional()
    .default(""),
  email: z
    .union([z.literal(""), z.string().trim().email("ایمیل معتبر نیست.")])
    .optional()
    .default(""),
});
export type InstituteInfoInput = z.infer<typeof instituteInfoSchema>;

/** Name-only accessor kept for existing consumers (login page reads it). */
export const instituteNameSchema = z.string().trim().min(1);
export type InstituteName = z.infer<typeof instituteNameSchema>;

// ---------------------------------------------------------------------------
// Time thresholds (B-8) — zero is rejected; each has its own documented range.
// ---------------------------------------------------------------------------

const dayCount = (max: number, message: string) =>
  numericInput.pipe(
    z.coerce
      .number({ invalid_type_error: message })
      .int(message)
      .min(1, "مقدار باید حداقل ۱ روز باشد.")
      .max(max, message),
  );

export const thresholdsSchema = z.object({
  archiveDays: dayCount(365, "تعداد روز باید بین ۱ تا ۳۶۵ باشد."),
  abandonmentDays: dayCount(365, "تعداد روز باید بین ۱ تا ۳۶۵ باشد."),
  staleDays: dayCount(180, "تعداد روز باید بین ۱ تا ۱۸۰ باشد."),
});
export type ThresholdsInput = z.infer<typeof thresholdsSchema>;

// ---------------------------------------------------------------------------
// Birthday greeting (B-9) — default OFF, send hour 0–23.
// ---------------------------------------------------------------------------

export const birthdaySchema = z.object({
  enabled: z.boolean(),
  sendHour: numericInput.pipe(
    z.coerce
      .number({ invalid_type_error: "ساعت باید عددی بین ۰ تا ۲۳ باشد." })
      .int("ساعت باید عددی بین ۰ تا ۲۳ باشد.")
      .min(0, "ساعت باید عددی بین ۰ تا ۲۳ باشد.")
      .max(23, "ساعت باید عددی بین ۰ تا ۲۳ باشد."),
  ),
});
export type BirthdayInput = z.infer<typeof birthdaySchema>;

// ---------------------------------------------------------------------------
// SMS gateway (B-10) — provider from a supported list; apiKey optional on
// update (blank means "keep the stored key"); real-send is the safety switch.
// ---------------------------------------------------------------------------

export const SMS_PROVIDER_VALUES = [
  "kavenegar",
  "melipayamak",
  "ghasedak",
] as const;

export const smsGatewaySchema = z.object({
  provider: z.enum(SMS_PROVIDER_VALUES, {
    errorMap: () => ({ message: "سامانه پیامک انتخاب‌شده معتبر نیست." }),
  }),
  senderNumber: z
    .string()
    .trim()
    .transform((v) => toEnglishDigits(v))
    .pipe(z.string().min(3, "شماره فرستنده معتبر نیست.").max(20)),
  realSend: z.boolean(),
  // Blank / omitted → keep the existing key (never echoed back to the client).
  apiKey: z.string().trim().optional().default(""),
});
export type SmsGatewayInput = z.infer<typeof smsGatewaySchema>;

// ---------------------------------------------------------------------------
// SMS templates (B-10) — body may be empty (empty template ⇒ event skipped).
// ---------------------------------------------------------------------------

export const smsTemplateSchema = z.object({
  body: z
    .string()
    .max(800, "متن پیامک نباید بیش از ۸۰۰ نویسه باشد.")
    .default(""),
});
export type SmsTemplateInput = z.infer<typeof smsTemplateSchema>;
