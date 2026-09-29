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

/** Optional total amount in whole Toman (0 .. 2,000,000,000).
 *  Accepts string, number, or null; result is `number | null`. Empty → null. */
const optionalAmount = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null) return "";
    if (typeof v === "number") return String(v);
    return toEnglishDigits(v.trim());
  })
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

// --- Stage engine (C-6 / Phase 10) ------------------------------------------
// Isomorphic: the client stage engine and the stage API routes validate against
// the same objects, so a hand-crafted request cannot skip a rule (rule 3).

/** A stage action: the five status transitions + the note edit. `note` is
 *  mandatory for Reject (C-6) and is the text written/cleared for Note. */
export const stageActionSchema = z
  .object({
    op: z.enum(["start", "done", "reject", "not_needed", "reopen", "note"]),
    note: z
      .string()
      .trim()
      .max(1000, { message: "حداکثر ۱۰۰۰ نویسه مجاز است." })
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => d.op !== "reject" || (d.note !== undefined && d.note.trim() !== ""), {
    message: "ثبت یادداشت برای رد مرحله الزامی است.",
    path: ["note"],
  });

export type StageActionInput = z.infer<typeof stageActionSchema>;

/** Add an exceptional stage to a case's current period (C-6). */
export const addStageSchema = z.object({
  periodId: z.string().trim().min(1),
  title: z
    .string()
    .trim()
    .min(1, { message: "عنوان مرحله الزامی است." })
    .max(200, { message: "حداکثر ۲۰۰ نویسه مجاز است." }),
});

export type AddStageInput = z.infer<typeof addStageSchema>;

/** Reorder or delete an exceptional stage (C-6). A separate structural op from
 *  the status transitions, gated by stages.add_exceptional. */
export const stageStructuralSchema = z.object({
  op: z.enum(["move_up", "move_down", "delete"]),
});

export type StageStructuralInput = z.infer<typeof stageStructuralSchema>;

// --- Cancellation & restore (C-8 / Phase 14) --------------------------------
// Isomorphic: the cancel dialog and the cancel/restore API routes validate the
// same objects, so a hand-crafted request cannot skip the reason requirement the
// dialog enforces (rule 3). Whether the reason is *active* and whether the case
// is in a cancellable state are business rules the service owns.

/** Cancel a case (C-8): a mandatory active reason + an optional note (≤ 500). */
export const caseCancelSchema = z.object({
  caseId: requiredId("شناسهٔ پرونده الزامی است."),
  cancellationReasonId: requiredId("انتخاب دلیل لغو الزامی است."),
  note: z
    .string()
    .trim()
    .max(500, { message: "حداکثر ۵۰۰ نویسه مجاز است." })
    .optional()
    .or(z.literal("")),
});

export type CaseCancelInput = z.infer<typeof caseCancelSchema>;

/** Restore a cancelled case (C-8, manager only — the role gate is server-side). */
export const caseRestoreSchema = z.object({
  caseId: requiredId("شناسهٔ پرونده الزامی است."),
});

export type CaseRestoreInput = z.infer<typeof caseRestoreSchema>;

// --- Change owner (C-5 header action) --------------------------------------
// Isomorphic: the owner-change dialog and its API route validate the same
// object, so a hand-crafted request cannot skip a rule the dialog enforces
// (rule 3). Whether the new owner is active and different from the current
// one is a business rule the service owns.

/** Reassign a case to another active employee. `moveOpenTasks` controls whether
 *  the case's OPEN tasks travel with it (the dialog defaults it to true). */
export const caseChangeOwnerSchema = z.object({
  caseId: requiredId("شناسهٔ پرونده الزامی است."),
  newOwnerId: requiredId("انتخاب مسئول جدید الزامی است."),
  moveOpenTasks: z.boolean(),
  note: z
    .string()
    .trim()
    .max(500, { message: "حداکثر ۵۰۰ نویسه مجاز است." })
    .optional()
    .or(z.literal("")),
});

export type CaseChangeOwnerInput = z.infer<typeof caseChangeOwnerSchema>;