import { z } from "zod";

// Validation for settings values. Each well-known key has its own shape; the
// schemas live here so the module owns its contract, and the settings-edit
// screen (a later phase) validates against the same schemas the reads assume.

/** Institute name shown on the login page and headings — non-empty text. */
export const instituteNameSchema = z.string().trim().min(1);
export type InstituteName = z.infer<typeof instituteNameSchema>;
