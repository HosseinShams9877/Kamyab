// Public API of the customers module (C-3). Other code imports customers
// functionality from "@/modules/customers" only — never reach into the
// service/repository/guard files directly. Client components import the
// isomorphic schema/types leaves ("@/modules/customers/customers.schema" and
// ".../customers.types") instead, since this barrel pulls in server-only code
// (Prisma).

export {
  listCustomers,
  getCustomer,
  getCustomerPageData,
  listCityOptions,
  listActiveCustomerOptions,
  saveCaseBirthInfoTx,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
  listGreetingCandidates,
} from "./customers.service";

export {
  createCustomerSchema,
  updateCustomerSchema,
  setCustomerStatusSchema,
} from "./customers.schema";

export type {
  CreateCustomerInput,
  UpdateCustomerInput,
  SetCustomerStatusInput,
} from "./customers.schema";

export type {
  CustomerListItem,
  CustomerDetail,
  CustomerCaseSummary,
  CustomerOption,
  FollowUpEntry,
  CustomerPageData,
  CustomerSort,
  CustomerListParams,
  CustomerListResult,
} from "./customers.types";

export {
  isValidNationalId,
  customerDisplayName,
  buildMobileTakenMessage,
  buildDeleteBlockedMessage,
} from "./customers.guards";

// Module UI + presentation. Server code (app/ pages) imports these through the
// barrel. The components are client leaves that import the isomorphic schema /
// types leaves directly (never this barrel, which pulls in Prisma).
export { CustomerForm } from "./components/customer-form";
export { CustomerActions } from "./components/customer-actions";

export {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_SORT_LABELS,
  CASE_STATUS_LABELS,
} from "./lib/labels";
