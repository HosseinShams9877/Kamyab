import type { RenewalEffect } from "@/types/enums";

// Presentation-only labels for the followups domain (C-11 / B-6). Isomorphic leaf
// (client-safe): the record-result form and the case timeline import this directly,
// never the barrel. The logic keys off the stored English enum, never the label.

/** How a result's effect-on-renewal reads in the timeline (B-6). */
export const RENEWAL_EFFECT_LABELS: Record<RenewalEffect, string> = {
  NONE: "بدون اثر بر تمدید",
  AGREES_TO_RENEW: "موافق تمدید",
  NOT_INTERESTED: "منصرف از تمدید",
};
