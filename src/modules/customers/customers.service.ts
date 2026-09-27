import { Prisma } from "@prisma/client";
import type { Prisma as PrismaNS } from "@prisma/client";
import type { CustomerType } from "@/types/enums";
import {
  parseJalali,
  toGregorianDate,
  toJalali,
  formatJalali,
  todayJalali,
} from "@/lib/jalali";
import { toEnglishDigits } from "@/lib/digits";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customers.schema";
import type {
  CustomerDetail,
  CustomerListItem,
  CustomerListParams,
  CustomerListResult,
  CustomerPageData,
  CustomerCaseSummary,
  CustomerOption,
  FollowUpEntry,
  CustomerStats,
  ServiceFilterOption,
  EmployeeFilterOption,
} from "./customers.types";
import {
  buildDeleteBlockedMessage,
  buildMobileTakenMessage,
  customerDisplayName,
} from "./customers.guards";
import * as repo from "./customers.repository";
import type { CustomerWriteData, CaseWithDetail } from "./customers.repository";

// Business logic for the customers domain (C-3). The service is the module's
// only cross-module entry point; the route boundary supplies the acting user.
// Jalali<->Date conversion, display-name formatting, and the delete/deactivate
// rules live here — the repository stays a thin DB layer.

const PAGE_SIZE = 10;
const CREATE_RETRIES = 5;
const CASE_STATUS_DONE = ["DONE", "NOT_NEEDED"];

type FieldError = { ok: false; field: string; message: string };

/** Display name from a mobile-lookup row (its `type` is a raw string column). */
function nameOf(row: {
  type: string;
  fullName: string | null;
  companyName: string | null;
  code: string;
}): string {
  return customerDisplayName({
    type: row.type as CustomerType,
    fullName: row.fullName,
    companyName: row.companyName,
    code: row.code,
  });
}

/** Trim an optional text value; empty/whitespace becomes null for storage. */
function orNull(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

/** A normalized Jalali "YYYY/MM/DD" string (ASCII) to a Date at local midnight. */
function jalaliToDate(value: string): Date | null {
  const j = parseJalali(value);
  return j ? toGregorianDate(j) : null;
}

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date | null): string | null {
  if (!date) return null;
  return formatJalali(toJalali(date), { persianDigits: false });
}

/**
 * Reduce a validated form input to the columns to store: fields that do not
 * apply to the chosen type are nulled, optional text is trimmed to null, and the
 * two Jalali date strings are converted to Dates.
 */
function toWriteData(
  input: CreateCustomerInput | UpdateCustomerInput,
): CustomerWriteData {
  const isNatural = input.type === "NATURAL";
  return {
    type: input.type,
    fullName: isNatural ? orNull(input.fullName) : null,
    companyName: isNatural ? null : orNull(input.companyName),
    mobile: input.mobile,
    nationalId: isNatural ? orNull(input.nationalId) : null,
    nationalEntityId: isNatural ? null : orNull(input.nationalEntityId),
    registrationNumber: isNatural ? null : orNull(input.registrationNumber),
    birthDate: isNatural ? jalaliToDate(input.birthDate) : null,
    foundingDate: isNatural ? null : jalaliToDate(input.foundingDate),
    sendGreeting: input.sendGreeting,
    landline: orNull(input.landline),
    city: orNull(input.city),
    address: orNull(input.address),
    notes: orNull(input.notes),
  };
}

function rowToDetail(row: repo.CustomerRow): CustomerDetail {
  return {
    id: row.id,
    code: row.code,
    type: row.type as CustomerType,
    fullName: row.fullName,
    companyName: row.companyName,
    mobile: row.mobile,
    nationalId: row.nationalId,
    nationalEntityId: row.nationalEntityId,
    registrationNumber: row.registrationNumber,
    birthDate: dateToJalali(row.birthDate),
    foundingDate: dateToJalali(row.foundingDate),
    sendGreeting: row.sendGreeting,
    landline: row.landline,
    city: row.city,
    address: row.address,
    notes: row.notes,
    status: row.status,
  };
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const row = await repo.findCustomerRowById(id);
  return row ? rowToDetail(row) : null;
}

export async function listCityOptions(): Promise<string[]> {
  return repo.listCities();
}

/** The four headline numbers on top of the customer list (C-3). */
export async function getCustomerStats(): Promise<CustomerStats> {
  const [total, active, inactive, nearRenewal] = await Promise.all([
    repo.countCustomers(),
    repo.countCustomersByStatus(true),
    repo.countCustomersByStatus(false),
    repo.countCustomersNearRenewal(30),
  ]);
  return { total, active, nearRenewal, inactive };
}

/** Active services for the list's service filter dropdown. */
export async function listServiceOptions(): Promise<ServiceFilterOption[]> {
  return repo.listActiveServiceOptions();
}

/** Active employees for the list's employee filter dropdown. */
export async function listEmployeeOptions(): Promise<EmployeeFilterOption[]> {
  return repo.listActiveEmployeeOptions();
}

/** Paginated, filtered customer list (C-3). 25 rows per page, server-side. */
export async function listCustomers(
  params: CustomerListParams,
): Promise<CustomerListResult> {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q ? toEnglishDigits(params.q.trim()) : "";
  const status =
    params.status === "active" ? true : params.status === "inactive" ? false : null;
  const type = params.type ? (params.type as CustomerType) : null;
  const sort = params.sort ?? "newest";

  const { rows, total } = await repo.listCustomers({
    q,
    type,
    status,
    city: params.city && params.city.trim() ? params.city.trim() : null,
    serviceId:
      params.serviceId && params.serviceId.trim() ? params.serviceId.trim() : null,
    sort,
    ...(params.ownerId ? { ownerId: params.ownerId } : {}),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const ids = rows.map((r) => r.id);
  const [activeByCustomer, servicesByCustomer, ownersByCustomer, followUpsByCustomer] =
    await Promise.all([
      repo.countActiveCasesByCustomer(ids),
      repo.findActiveServiceNamesByCustomer(ids),
      repo.findLatestOwnerByCustomer(ids),
      repo.findLatestFollowUpByCustomer(ids),
    ]);

  const items: CustomerListItem[] = rows.map((r) => {
    const lastFollowUp = followUpsByCustomer[r.id];
    return {
      id: r.id,
      code: r.code,
      displayName: customerDisplayName({
        type: r.type as CustomerType,
        fullName: r.fullName,
        companyName: r.companyName,
        code: r.code,
      }),
      type: r.type as CustomerType,
      mobile: r.mobile,
      city: r.city,
      activeCases: activeByCustomer[r.id] ?? 0,
      status: r.status,
      activeServiceNames: servicesByCustomer[r.id] ?? [],
      ownerName: ownersByCustomer[r.id] ?? null,
      lastFollowUpAt: lastFollowUp
        ? formatJalali(toJalali(lastFollowUp), { persianDigits: false })
        : null,
    };
  });

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}

function isUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function targetsMobile(e: Prisma.PrismaClientKnownRequestError): boolean {
  const t = e.meta?.target;
  const s = Array.isArray(t) ? t.join(",") : String(t ?? "");
  return s.includes("mobile");
}

/**
 * Create a customer (C-3). Enforces mobile uniqueness with a name-carrying
 * Persian message, then creates inside a transaction that generates the
 * per-year code. A code-collision race is retried; a mobile-collision race is
 * mapped back to the field.
 */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<{ ok: true; id: string } | FieldError> {
  const existing = await repo.findCustomerByMobile(input.mobile);
  if (existing) {
    return {
      ok: false,
      field: "mobile",
      message: buildMobileTakenMessage(nameOf(existing)),
    };
  }

  const data = toWriteData(input);
  const year = todayJalali().jy;

  for (let attempt = 0; attempt < CREATE_RETRIES; attempt++) {
    try {
      const { id } = await repo.createCustomerWithCode(data, year);
      return { ok: true, id };
    } catch (e) {
      if (isUniqueError(e)) {
        if (targetsMobile(e)) {
          const owner = await repo.findCustomerByMobile(input.mobile);
          return {
            ok: false,
            field: "mobile",
            message: buildMobileTakenMessage(owner ? nameOf(owner) : ""),
          };
        }
        continue; // code collision — regenerate and retry
      }
      throw e;
    }
  }
  return { ok: false, field: "code", message: "ثبت کد مشتری ناموفق بود. دوباره تلاش کنید." };
}

/** Update a customer (C-3). Mobile uniqueness is re-checked excluding this record. */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<{ ok: true } | FieldError> {
  const current = await repo.findCustomerRowById(id);
  if (!current) return { ok: false, field: "id", message: "مشتری یافت نشد." };

  const owner = await repo.findCustomerByMobile(input.mobile);
  if (owner && owner.id !== id) {
    return {
      ok: false,
      field: "mobile",
      message: buildMobileTakenMessage(nameOf(owner)),
    };
  }

  try {
    await repo.updateCustomer(id, toWriteData(input));
    return { ok: true };
  } catch (e) {
    if (isUniqueError(e) && targetsMobile(e)) {
      return { ok: false, field: "mobile", message: buildMobileTakenMessage("") };
    }
    throw e;
  }
}

export async function setCustomerStatus(id: string, status: boolean): Promise<void> {
  await repo.setCustomerStatus(id, status);
}

// --- Engine seam (C-14 / Phase 15) ------------------------------------------

/** Greeting-eligible customers with the applicable date reduced to Jalali parts
 *  (a NATURAL customer's birthDate, a LEGAL customer's foundingDate), for the
 *  engine's once-a-year greeting. The engine matches month+day against today; the
 *  BirthdayLog unique index guarantees at most one greeting per customer per year. */
export async function listGreetingCandidates(): Promise<
  {
    customerId: string;
    type: string;
    fullName: string | null;
    companyName: string | null;
    mobile: string;
    birth: { jy: number; jm: number; jd: number } | null;
  }[]
> {
  const rows = await repo.findGreetingCandidates();
  return rows.map((r) => {
    const date = r.type === "LEGAL" ? r.foundingDate : r.birthDate;
    return {
      customerId: r.id,
      type: r.type,
      fullName: r.fullName,
      companyName: r.companyName,
      mobile: r.mobile,
      birth: date ? toJalali(date) : null,
    };
  });
}

// --- Case-registration seams (C-4) -----------------------------------------

/** True when the customer already has the birth/founding date its type needs. */
function hasBirthInfo(row: repo.ActiveCustomerRow): boolean {
  return row.type === "NATURAL" ? row.birthDate !== null : row.foundingDate !== null;
}

/** Active customers for the case-form pick, filtered by an optional search term. */
export async function listActiveCustomerOptions(
  q?: string,
): Promise<CustomerOption[]> {
  const term = q ? toEnglishDigits(q.trim()) : "";
  const rows = await repo.listActiveCustomers(term);
  return rows.map((r) => ({
    id: r.id,
    displayName: customerDisplayName({
      type: r.type as CustomerType,
      fullName: r.fullName,
      companyName: r.companyName,
      code: r.code,
    }),
    type: r.type as CustomerType,
    mobile: r.mobile,
    hasBirthInfo: hasBirthInfo(r),
    sendGreeting: r.sendGreeting,
  }));
}

/**
 * Save the birth/founding date and greeting flag the case form collected onto
 * the CUSTOMER (not the case — B-9: a customer with three services must not get
 * three greetings), on the cases module's save transaction (rule 4). A Jalali
 * date string is converted here; the date is only written when the customer
 * still lacks it, but the greeting flag is always applied.
 */
export function saveCaseBirthInfoTx(
  tx: PrismaNS.TransactionClient,
  customerId: string,
  input: { type: CustomerType; birthDate?: string; foundingDate?: string; sendGreeting: boolean },
): Promise<void> {
  const patch: repo.BirthInfoPatch = { sendGreeting: input.sendGreeting };
  if (input.type === "NATURAL") {
    const d = input.birthDate ? jalaliToDate(input.birthDate) : null;
    if (d) patch.birthDate = d;
  } else {
    const d = input.foundingDate ? jalaliToDate(input.foundingDate) : null;
    if (d) patch.foundingDate = d;
  }
  return repo.saveBirthInfoTx(tx, customerId, patch);
}

/**
 * Delete a customer (C-3). Allowed ONLY when the customer has no case; otherwise
 * blocked with a Persian message stating the count (the UI must deactivate
 * instead). Never deletes a customer that owns cases.
 */
export async function deleteCustomer(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const caseCount = await repo.countCustomerCases(id);
  if (caseCount > 0) {
    return { ok: false, message: buildDeleteBlockedMessage(caseCount) };
  }
  await repo.deleteCustomer(id);
  return { ok: true };
}

// --- Customer page ---------------------------------------------------------

function summarizeCase(c: CaseWithDetail): CustomerCaseSummary {
  // The "current" period is the active one, else the most recent (index desc).
  const current =
    c.periods.find((p) => p.status === "ACTIVE") ?? c.periods[0] ?? null;

  let stagesDone = 0;
  let stagesTotal = 0;
  let currentStageTitle: string | null = null;
  if (current) {
    stagesTotal = current.stages.length;
    stagesDone = current.stages.filter((s) => CASE_STATUS_DONE.includes(s.status)).length;
    const open = current.stages.find(
      (s) => s.status !== "DONE" && s.status !== "NOT_NEEDED",
    );
    currentStageTitle = open ? open.title : null;
  }

  // Balance across ALL periods: sum(totals) - sum(payments). null when no period
  // has a total (the UI shows "—", never zero).
  let anyTotal = false;
  let totalSum = 0;
  let paidSum = 0;
  for (const p of c.periods) {
    if (p.totalAmount !== null) {
      anyTotal = true;
      totalSum += Number(p.totalAmount);
    }
    for (const pay of p.payments) paidSum += Number(pay.amount);
  }

  return {
    id: c.id,
    number: c.number,
    serviceName: c.service.name,
    status: c.status,
    currentStageTitle,
    stagesDone,
    stagesTotal,
    balance: anyTotal ? totalSum - paidSum : null,
  };
}

/** Everything the customer page needs beyond the top card (C-3). */
export async function getCustomerPageData(id: string): Promise<CustomerPageData> {
  const [cases, followUps] = await Promise.all([
    repo.findCasesByCustomer(id),
    repo.findFollowUpsByCustomer(id),
  ]);

  const summaries = cases.map(summarizeCase);

  // Grand total balance across all cases; null only when NO case has any total.
  let anyBalance = false;
  let totalBalance = 0;
  for (const s of summaries) {
    if (s.balance !== null) {
      anyBalance = true;
      totalBalance += s.balance;
    }
  }

  const timeline: FollowUpEntry[] = followUps.map((f) => ({
    id: f.id,
    caseNumber: f.case.number,
    resultTitle: f.result.title,
    note: f.note,
    authorName: f.createdBy.fullName,
    createdAt: f.createdAt,
  }));

  return {
    cases: summaries,
    totalBalance: anyBalance ? totalBalance : null,
    caseCount: cases.length,
    followUps: timeline,
  };
}