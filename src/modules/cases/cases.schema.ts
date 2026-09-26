import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali, isFutureJalali } from "@/lib/jalali";

// Shared validation for the cases domain (C-4 registration). The SAME object
// validates in the browser (React Hook Form) and on the server (the POST route),
// so a hand-crafted request cannot bypass a rule the form enforces. This is an
// isomorphic leaf: the client form imports it directly (the module barrel pulls
// in Prisma), and everything it imports (digits, jalali) is client-safe. Field
// messages are Persian; the renewable/duration cross-check is a business rule the
// service owns (the schema does not know a service's `renewable` flag).

/** A required id selected from a pick list. */
function requiredId(message: string) {
  return z.string().trim().min(1, { message });
}

/** Required Jalali "YYYY/MM/DD" that must be a real date and not in the future.
 *  Digits are normalized to ASCII so the server always stores a canonical string. */
const startDate = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v !== "", { message: "تاریخ شروع الزامی است." })
  .refine((v) => v === "" || parseJalali(v) !== null, {
    message: "تاریخ شروع معتبر نیست.",
  })
  .refine(
    (v) => {
      const j = parseJalali(v);
      return j === null || !isFutureJalali(j);
    },
    { message: "تاریخ شروع نمی‌تواند در آینده باشد." },
  );

/** Optional Jalali date (customer birth/founding), not in the future. Empty → "". */
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

/** Optional total amount in whole Toman (0 .. 2,000,000,000). Empty → null. */
const optionalAmount = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || /^\d+$/.test(v), { message: "مبلغ باید عددی باشد." })
  .refine((v) => v === "" || Number(v) <= 2_000_000_000, {
    message: "مبلغ واردشده بیش از حد مجاز است.",
  })
  .transform((v) => (v === "" ? null : Number(v)));

/** Optional notes, ≤ 1000 characters. */
const optionalNotes = z
  .string()
  .trim()
  .max(1000, { message: "حداکثر ۱۰۰۰ نویسه مجاز است." })
  .optional()
  .or(z.literal(""));

export const caseCreateSchema = z.object({
  customerId: requiredId("انتخاب مشتری الزامی است."),
  serviceId: requiredId("انتخاب خدمت الزامی است."),
  ownerId: requiredId("انتخاب مسئول پرونده الزامی است."),
  // Optional at the schema level; the service requires it for a renewable service.
  durationId: z.string().trim().optional().or(z.literal("")),
  startDate,
  totalAmount: optionalAmount,
  notes: optionalNotes,
  // Customer birth/founding date the form may backfill when it was missing.
  birthDate: optionalJalaliNotFuture("تاریخ تولد نمی‌تواند در آینده باشد."),
  foundingDate: optionalJalaliNotFuture("تاریخ تأسیس نمی‌تواند در آینده باشد."),
  sendGreeting: z.boolean(),
});

export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
