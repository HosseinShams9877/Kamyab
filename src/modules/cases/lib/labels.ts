import { toPersianDigits } from "@/lib/digits";
import type { CaseStatus } from "@/types/enums";

// Presentation-only labels for the cases domain (rule 10 keeps these out of the
// service/guards). Persian UI text lives here; identifiers stay English. This is
// an isomorphic leaf so the case page (server) and the case form (client) share
// one source for status labels and the stage-count hint.

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "جدید",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

/** Badge tone (background + text token pair) for each case status. */
export const CASE_STATUS_BADGE: Record<CaseStatus, string> = {
  NEW: "bg-info-bg text-info",
  IN_PROGRESS: "bg-warning-bg text-warning",
  COMPLETED: "bg-success-bg text-success",
  CANCELLED: "bg-disabled-bg text-disabled",
};

/** The hint shown under a picked service in the form (C-4): "این خدمت ۷ مرحله دارد." */
export function stageCountHint(count: number): string {
  return `این خدمت ${toPersianDigits(String(count))} مرحله دارد.`;
}
