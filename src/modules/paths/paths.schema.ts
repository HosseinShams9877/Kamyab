// Isomorphic Zod schemas for the paths module (B-2 stages, B-3 durations). Safe
// on client and server: pure Zod + shared digit helpers, no server-only imports.
// Numeric fields are normalized from Persian to English digits first (a manager
// may type either). Ranges follow 04-manager-defined.md (B-2, B-3).

import { z } from "zod";
import { toEnglishDigits } from "@/lib/digits";
import { PathType as pathTypeSchema } from "@/types/enums.schema";

/** Normalize an incoming numeric string/number to English digits, trimmed. */
const numericInput = z
  .union([z.string(), z.number()])
  .transform((v) => toEnglishDigits(String(v)).trim());

// ---------------------------------------------------------------------------
// Path stages (B-2) — a stage is a title only (no assignee/deadline/cost).
// ---------------------------------------------------------------------------

const stageTitleSchema = z
  .string()
  .trim()
  .min(2, "عنوان مرحله باید حداقل ۲ نویسه باشد.")
  .max(120, "عنوان مرحله نباید بیش از ۱۲۰ نویسه باشد.");

export const stageCreateSchema = z.object({
  pathType: pathTypeSchema,
  title: stageTitleSchema,
});
export type StageCreateInput = z.infer<typeof stageCreateSchema>;

/** Rename a stage (B-2 edit title). */
export const stageUpdateSchema = z.object({ title: stageTitleSchema });
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;

/** Move a stage one position up or down (B-2). Order is implicit, never typed. */
export const stageMoveSchema = z.object({
  direction: z.enum(["up", "down"]),
});
export type StageMoveInput = z.infer<typeof stageMoveSchema>;

// ---------------------------------------------------------------------------
// Validity durations (B-3) — only for renewable services.
// ---------------------------------------------------------------------------

const durationTitleSchema = z
  .string()
  .trim()
  .min(1, "عنوان مدت را وارد کنید.")
  .max(60, "عنوان مدت نباید بیش از ۶۰ نویسه باشد.");

const monthCountSchema = numericInput.pipe(
  z.coerce
    .number({ invalid_type_error: "تعداد ماه باید یک عدد صحیح باشد." })
    .int("تعداد ماه باید یک عدد صحیح باشد.")
    .min(1, "تعداد ماه باید بین ۱ تا ۱۲۰ باشد.")
    .max(120, "تعداد ماه باید بین ۱ تا ۱۲۰ باشد."),
);

export const durationCreateSchema = z.object({
  title: durationTitleSchema,
  monthCount: monthCountSchema,
  isDefault: z.boolean().default(false),
});
export type DurationCreateInput = z.infer<typeof durationCreateSchema>;

/** Edit a duration. A used duration is rename-only (B-3), enforced in the service. */
export const durationUpdateSchema = z.object({
  title: durationTitleSchema,
  monthCount: monthCountSchema,
  isDefault: z.boolean().default(false),
});
export type DurationUpdateInput = z.infer<typeof durationUpdateSchema>;

/** Activate / deactivate a duration (B-3). Always allowed, even when in use. */
export const durationSetActiveSchema = z.object({ active: z.boolean() });
export type DurationSetActiveInput = z.infer<typeof durationSetActiveSchema>;
