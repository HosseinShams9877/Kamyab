import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { parseJalali, isFutureJalali } from "@/lib/jalali";
import {
  MAX_AMOUNT,
  MAX_NOTE,
  AMOUNT_INVALID,
  AMOUNT_TOO_LARGE,
  RECEIPT_DATE_INVALID,
  RECEIPT_DATE_FUTURE,
  METHOD_REQUIRED,
  PERIOD_REQUIRED,
  NOTE_TOO_LONG,
} from "./payments.guards";

// Shared validation for the payments domain (C-7). The SAME objects validate in
// the browser (the financial panel) and on the server (the payment API routes),
// so a hand-crafted request cannot bypass a rule the form enforces (rule 3).
// Isomorphic leaf: the client imports it directly (the barrel pulls in Prisma),
// and everything it imports (digits, jalali, guards) is client-safe. Field
// messages are Persian. Whether a method/period id actually exists is a business
// rule the service owns (the schema does not know the DB).

/** Required amount in whole Toman: greater than zero, up to 2 billion. Digits are
 *  normalized to ASCII so the server always parses a canonical integer. */
const amount = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => /^\d+$/.test(v) && Number(v) > 0, { message: AMOUNT_INVALID })
  .refine((v) => Number(v) <= MAX_AMOUNT, { message: AMOUNT_TOO_LARGE })
  .transform((v) => Number(v));

/** Required Jalali "YYYY/MM/DD" receipt date that must be a real date and not in
 *  the future. Digits normalized to ASCII for a canonical stored string. */
const receiptDate = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => parseJalali(v) !== null, { message: RECEIPT_DATE_INVALID })
  .refine(
    (v) => {
      const j = parseJalali(v);
      return j !== null && !isFutureJalali(j);
    },
    { message: RECEIPT_DATE_FUTURE },
  );

/** Optional note, ≤ 300 characters (C-7). Empty → "". */
const note = z
  .string()
  .trim()
  .max(MAX_NOTE, { message: NOTE_TOO_LONG })
  .optional()
  .or(z.literal(""));

/** Record a payment (C-7). periodId is always required — it is the payment's
 *  period ("for which"); the UI only shows the picker when the case has more
 *  than one period, but every payment belongs to exactly one. */
export const paymentCreateSchema = z.object({
  periodId: z.string().trim().min(1, { message: PERIOD_REQUIRED }),
  methodId: z.string().trim().min(1, { message: METHOD_REQUIRED }),
  amount,
  receiptDate,
  note,
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

/** Optional total amount in whole Toman (0 .. 2,000,000,000). Empty → null (the
 *  card then shows "—" for balance). Used only by "adjust total". */
const optionalTotal = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .refine((v) => v === "" || /^\d+$/.test(v), { message: "مبلغ باید عددی باشد." })
  .refine((v) => v === "" || Number(v) <= MAX_AMOUNT, { message: AMOUNT_TOO_LARGE })
  .transform((v) => (v === "" ? null : Number(v)));

/** Adjust a period's agreed total (C-7): changes only that period's total, never
 *  its payments. An empty total clears it back to "—". */
export const adjustTotalSchema = z.object({
  periodId: z.string().trim().min(1, { message: PERIOD_REQUIRED }),
  totalAmount: optionalTotal,
});

export type AdjustTotalInput = z.infer<typeof adjustTotalSchema>;
