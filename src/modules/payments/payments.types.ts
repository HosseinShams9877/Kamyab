// Domain types for the payments module (C-7 financial card). Isomorphic leaf:
// pure types, safe to import from client components. Money is integer Toman
// (number here; BigInt only at the Prisma edge). Dates surface as Jalali
// "YYYY/MM/DD" strings so no consumer deals with Gregorian Date objects. The
// financial figures (paid/balance/percent/label) are computed at read time
// (rule 2) — nothing here is a stored aggregate.

/** The four C-7 status labels a period's money can be in (all computed). */
export type PaymentStatusKey = "unpaid" | "prepayment" | "settled" | "overpaid";

/** One recorded payment of a period, as the financial card lists it. */
export type PaymentRow = {
  id: string;
  amount: number; // integer Toman, > 0
  receiptDate: string; // Jalali YYYY/MM/DD (ASCII digits)
  methodTitle: string;
  note: string | null;
  recordedByName: string;
  periodId: string;
  periodIndex: number; // which period this payment is for (multi-period cases)
};

/** A selectable payment method (from the settings method list). */
export type PaymentMethodOption = {
  id: string;
  title: string;
};

/** A period the payment form may target ("for which"), newest first. */
export type PaymentPeriodOption = {
  id: string;
  indexNumber: number;
  label: string; // "دورهٔ ثبت اولیه" / "دورهٔ ۲" ...
};

/** Everything the case page's Payments tab needs, gathered by the service. */
export type CaseFinancial = {
  payments: PaymentRow[];
  methods: PaymentMethodOption[];
  periods: PaymentPeriodOption[];
};
