// Isomorphic Zod schemas for the services domain (B-1 service, B-4 reminder
// rules). Safe on client and server: pure Zod + shared digit helpers, no
// server-only imports. Numeric fields are normalized from Persian to English
// digits first (a manager may type either). Ranges follow 04-manager-defined.md.

import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import {
  ReminderChannel as reminderChannelSchema,
  ReminderRecipient as reminderRecipientSchema,
} from "@/types/enums.schema";

/** Normalize an incoming numeric string/number to English digits, trimmed. */
const numericInput = z
  .union([z.string(), z.number()])
  .transform((v) => toEnglishDigits(String(v)).trim());

// ---------------------------------------------------------------------------
// Service (B-1)
// ---------------------------------------------------------------------------

const nameSchema = z
  .string()
  .trim()
  .min(2, "نام خدمت باید حداقل ۲ نویسه باشد.")
  .max(80, "نام خدمت نباید بیش از ۸۰ نویسه باشد.");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "توضیحات نباید بیش از ۵۰۰ نویسه باشد.")
  .optional()
  .default("");

export const serviceCreateSchema = z.object({
  name: nameSchema,
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
  description: descriptionSchema,
  renewable: z.boolean().default(false),
  status: z.boolean().default(true),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

export const serviceUpdateSchema = serviceCreateSchema;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

/** A quick active/inactive toggle from the list (B-1 deactivate). */
export const serviceStatusSchema = z.object({ status: z.boolean() });
export type ServiceStatusInput = z.infer<typeof serviceStatusSchema>;

// ---------------------------------------------------------------------------
// Reminder rules (B-4)
// ---------------------------------------------------------------------------

// daysBefore: positive = before expiry, 0 = expiry day, negative = after.
const daysBeforeSchema = numericInput.pipe(
  z.coerce
    .number({ invalid_type_error: "تعداد روز باید یک عدد صحیح باشد." })
    .int("تعداد روز باید یک عدد صحیح باشد.")
    .min(-365, "بازه مجاز بین ۳۶۵- و ۳۶۵ روز است.")
    .max(365, "بازه مجاز بین ۳۶۵- و ۳۶۵ روز است."),
);

export const reminderRuleCreateSchema = z.object({
  daysBefore: daysBeforeSchema,
  channel: reminderChannelSchema,
  recipient: reminderRecipientSchema,
  active: z.boolean().default(true),
});
export type ReminderRuleCreateInput = z.infer<typeof reminderRuleCreateSchema>;

export const reminderRuleUpdateSchema = reminderRuleCreateSchema;
export type ReminderRuleUpdateInput = z.infer<typeof reminderRuleUpdateSchema>;
