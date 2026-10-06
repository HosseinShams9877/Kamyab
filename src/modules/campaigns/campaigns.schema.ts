import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali, isFutureJalali } from "@/lib/jalali";

// Isomorphic validation for the campaigns module. Same shape on client + server.

function requiredId(message: string) {
  return z.string().trim().min(1, { message });
}

const optionalJalali = (msg: string) =>
  z
    .string()
    .transform((v) => toEnglishDigits(v.trim()))
    .refine((v) => v === "" || parseJalali(v) !== null, { message: "تاریخ معتبر نیست." })
    .optional()
    .or(z.literal(""));

const audienceFilterSchema = z.object({
  customerType: z.enum(["NATURAL", "LEGAL"]).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  serviceIds: z.array(z.string().trim().min(1)).max(50).optional(),
  hasActiveCase: z.boolean().nullable().optional(),
  hasBalance: z.boolean().nullable().optional(),
  joinedAfter: optionalJalali("تاریخ عضویت نامعتبر است."),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
});

export const campaignCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "نام کمپین الزامی است." })
    .max(100, { message: "حداکثر ۱۰۰ نویسه." }),
  channel: z.enum(["SMS", "INTERNAL_NOTIFICATION"]),
  templateKey: z.string().trim().max(100).optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(1, { message: "متن پیام الزامی است." })
    .max(500, { message: "حداکثر ۵۰۰ نویسه." }),
  audienceFilter: audienceFilterSchema,
  scheduledAt: optionalJalali("زمان‌بندی نامعتبر است."),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignCancelSchema = z.object({
  campaignId: requiredId("شناسهٔ کمپین الزامی است."),
});
export type CampaignCancelInput = z.infer<typeof campaignCancelSchema>;

export const campaignSendSchema = z.object({
  campaignId: requiredId("شناسهٔ کمپین الزامی است."),
});
export type CampaignSendInput = z.infer<typeof campaignSendSchema>;