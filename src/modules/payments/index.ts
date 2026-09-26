// Public API of the payments module (C-7 financial card + payments). Other
// server code imports payments functionality from "@/modules/payments" only
// (rule 8). Client components are the exception: they import the isomorphic
// leaves (./payments.schema, ./payments.types, ./payments.guards) and the
// module's own lib/ directly, never this barrel (it pulls in server-only Prisma
// code via the service).

// --- Service (server-only: Prisma, transactions, cross-module seams) --------
export {
  canViewFinancial,
  canRecordPayments,
  canAdjustTotal,
  listPaymentMethodOptions,
  getCaseFinancial,
  recordPayment,
  deletePayment,
  adjustTotal,
} from "./payments.service";

// --- Schema (isomorphic) ----------------------------------------------------
export { paymentCreateSchema, adjustTotalSchema } from "./payments.schema";
export type { PaymentCreateInput, AdjustTotalInput } from "./payments.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  PaymentStatusKey,
  PaymentRow,
  PaymentMethodOption,
  PaymentPeriodOption,
  CaseFinancial,
} from "./payments.types";

// --- Guards (isomorphic: read-time computation + Persian messages) ----------
export { paymentStatus, paymentPercent, PaymentRuleError } from "./payments.guards";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_BADGE,
  paymentPeriodLabel,
} from "./lib/labels";

// --- Module UI (re-exported for server consumers: the case page) ------------
export { FinancialPanel } from "./components/financial-panel";
