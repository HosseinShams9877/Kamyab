import type { CustomerType } from "@/types/enums";
import type { CustomerSort } from "../customers.types";

// Presentation-only labels for the customers domain (rule 10 keeps these out of
// the service/guards). Persian UI text lives here; identifiers stay English.

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  NATURAL: "حقیقی",
  LEGAL: "حقوقی",
};

export const CUSTOMER_STATUS_LABELS: Record<"active" | "inactive", string> = {
  active: "فعال",
  inactive: "غیرفعال",
};

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  newest: "جدیدترین",
  name: "نام",
  cases: "تعداد پرونده",
};

// Case status badges shown on the customer page (a subset used there).
export const CASE_STATUS_LABELS: Record<string, string> = {
  NEW: "جدید",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};
