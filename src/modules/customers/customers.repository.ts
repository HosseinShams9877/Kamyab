import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CustomerType } from "@/types/enums";

// ALL Prisma access for the customers domain lives here (modular rule 9: the
// repository is the only file that touches the database for this module, and it
// is called only by customers.service). Persian text never appears in this
// layer — it deals in ids, counts, and rows. Jalali<->Date conversion and
// display-name formatting are business/presentation concerns handled by the
// service, so this layer speaks in Date objects and raw columns.

const ACTIVE_CASE_STATUSES = ["NEW", "IN_PROGRESS"] as const;

// The persisted column shape (dates as Date). The service maps this to the
// public CustomerDetail (dates as Jalali strings).
export type CustomerRow = {
  id: string;
  code: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  nationalId: string | null;
  nationalEntityId: string | null;
  registrationNumber: string | null;
  birthDate: Date | null;
  foundingDate: Date | null;
  sendGreeting: boolean;
  landline: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: boolean;
};

// The writable fields (no id/code — code is generated inside the transaction).
export type CustomerWriteData = {
  type: CustomerType;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  nationalId: string | null;
  nationalEntityId: string | null;
  registrationNumber: string | null;
  birthDate: Date | null;
  foundingDate: Date | null;
  sendGreeting: boolean;
  landline: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
};

const CUSTOMER_SELECT = {
  id: true,
  code: true,
  type: true,
  fullName: true,
  companyName: true,
  mobile: true,
  nationalId: true,
  nationalEntityId: true,
  registrationNumber: true,
  birthDate: true,
  foundingDate: true,
  sendGreeting: true,
  landline: true,
  city: true,
  address: true,
  notes: true,
  status: true,
} satisfies Prisma.CustomerSelect;

export async function findCustomerRowById(id: string): Promise<CustomerRow | null> {
  return prisma.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT });
}

/** For the mobile-uniqueness message: the current owner of a mobile, if any. */
export async function findCustomerByMobile(mobile: string): Promise<{
  id: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  code: string;
} | null> {
  return prisma.customer.findUnique({
    where: { mobile },
    select: { id: true, type: true, fullName: true, companyName: true, code: true },
  });
}

/**
 * Create a customer, generating its per-Jalali-year code inside one transaction
 * so the sequence read and the insert cannot interleave. The 4-digit zero-padded
 * suffix means a lexical "desc" order over a single year's codes is also the
 * numeric order. A unique-collision from a race is surfaced to the service,
 * which retries.
 */
export async function createCustomerWithCode(
  data: CustomerWriteData,
  jalaliYear: number,
): Promise<{ id: string; code: string }> {
  return prisma.$transaction(async (tx) => {
    const prefix = `CU-${jalaliYear}-`;
    const last = await tx.customer.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const seq = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    const code = `${prefix}${String(seq).padStart(4, "0")}`;
    const created = await tx.customer.create({
      data: { ...data, code },
      select: { id: true, code: true },
    });
    return created;
  });
}

export async function updateCustomer(id: string, data: CustomerWriteData): Promise<void> {
  await prisma.customer.update({ where: { id }, data });
}

export async function setCustomerStatus(id: string, status: boolean): Promise<void> {
  await prisma.customer.update({ where: { id }, data: { status } });
}

export async function deleteCustomer(id: string): Promise<void> {
  await prisma.customer.delete({ where: { id } });
}

// --- Case-registration seams (C-4) -----------------------------------------

export type ActiveCustomerRow = {
  id: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  code: string;
  mobile: string;
  birthDate: Date | null;
  foundingDate: Date | null;
  sendGreeting: boolean;
};

/** Active customers matching an optional search term, for the case-form pick. */
export async function listActiveCustomers(q: string): Promise<ActiveCustomerRow[]> {
  const where: Prisma.CustomerWhereInput = { status: true };
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { companyName: { contains: q } },
      { mobile: { contains: q } },
      { nationalId: { contains: q } },
      { nationalEntityId: { contains: q } },
      { code: { contains: q } },
    ];
  }
  return prisma.customer.findMany({
    where,
    orderBy: [{ companyName: "asc" }, { fullName: "asc" }],
    take: 50,
    select: {
      id: true,
      type: true,
      fullName: true,
      companyName: true,
      code: true,
      mobile: true,
      birthDate: true,
      foundingDate: true,
      sendGreeting: true,
    },
  });
}

/** The birth/founding-date + greeting fields the case form may set on the
 *  customer, written on the caller's save transaction (rule 4). */
export type BirthInfoPatch = {
  birthDate?: Date;
  foundingDate?: Date;
  sendGreeting?: boolean;
};

export async function saveBirthInfoTx(
  tx: Prisma.TransactionClient,
  id: string,
  data: BirthInfoPatch,
): Promise<void> {
  await tx.customer.update({ where: { id }, data });
}

export async function countCustomerCases(id: string): Promise<number> {
  return prisma.case.count({ where: { customerId: id } });
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------

/** Active, greeting-enabled customers that have a birth or founding date to match
 *  today against, for the birthday / founding-day greeting. The service reduces
 *  the applicable date to Jalali parts; the once-a-year guard is the BirthdayLog
 *  unique index. */
export type GreetingCandidateRow = {
  id: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  birthDate: Date | null;
  foundingDate: Date | null;
};

export async function findGreetingCandidates(): Promise<GreetingCandidateRow[]> {
  return prisma.customer.findMany({
    where: {
      status: true,
      sendGreeting: true,
      OR: [{ birthDate: { not: null } }, { foundingDate: { not: null } }],
    },
    select: {
      id: true,
      type: true,
      fullName: true,
      companyName: true,
      mobile: true,
      birthDate: true,
      foundingDate: true,
    },
  });
}

// --- List ------------------------------------------------------------------

export type ListQuery = {
  q: string;
  type: CustomerType | null;
  status: boolean | null;
  city: string | null;
  serviceId: string | null;
  sort: "newest" | "name" | "cases";
  /** Restrict to customers who own at least one ACTIVE case owned by this
   *  employee (C-15 "my customers"); omitted for the manager list. */
  ownerId?: string;
  skip: number;
  take: number;
};

function buildWhere(query: ListQuery): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.status !== null) where.status = query.status;
  if (query.city) where.city = query.city;

  // The service and owner filters both apply to ACTIVE cases only (C-3 / C-15):
  // a customer matches if ANY of their active cases has the chosen owner or
  // service. A customer with several active cases matches on any one of them.
  const activeCaseSome: Prisma.CaseWhereInput = {
    status: { in: [...ACTIVE_CASE_STATUSES] },
  };
  if (query.ownerId) activeCaseSome.ownerId = query.ownerId;
  if (query.serviceId) activeCaseSome.serviceId = query.serviceId;
  if (query.ownerId || query.serviceId) {
    where.cases = { some: activeCaseSome };
  }

  if (query.q) {
    where.OR = [
      { fullName: { contains: query.q } },
      { companyName: { contains: query.q } },
      { mobile: { contains: query.q } },
      { nationalId: { contains: query.q } },
      { nationalEntityId: { contains: query.q } },
      { code: { contains: query.q } },
    ];
  }
  return where;
}

function buildOrderBy(
  sort: ListQuery["sort"],
): Prisma.CustomerOrderByWithRelationInput | Prisma.CustomerOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ companyName: "asc" }, { fullName: "asc" }];
    case "cases":
      // Orders by TOTAL case count (Prisma relation count). The row shows the
      // ACTIVE-case count, which is computed separately.
      return { cases: { _count: "desc" } };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

export async function listCustomers(query: ListQuery): Promise<{
  rows: CustomerRow[];
  total: number;
}> {
  const where = buildWhere(query);
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: buildOrderBy(query.sort),
      skip: query.skip,
      take: query.take,
      select: CUSTOMER_SELECT,
    }),
    prisma.customer.count({ where }),
  ]);
  return { rows, total };
}

/** Active-case count per customer for a page of rows (rule 2: computed, not stored). */
export async function countActiveCasesByCustomer(
  ids: string[],
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const groups = await prisma.case.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, status: { in: [...ACTIVE_CASE_STATUSES] } },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const g of groups) map[g.customerId] = g._count._all;
  return map;
}

/** Distinct non-empty cities, for the list's city filter dropdown. */
export async function listCities(): Promise<string[]> {
  const rows = await prisma.customer.findMany({
    where: { city: { not: null } },
    distinct: ["city"],
    orderBy: { city: "asc" },
    select: { city: true },
  });
  return rows.map((r) => r.city).filter((c): c is string => !!c && c.trim() !== "");
}

// --- Per-customer extras for the list (C-3) ---------------------------------

/** Active-case service names per customer (badge column). */
export async function findActiveServiceNamesByCustomer(
  ids: string[],
): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const rows = await prisma.case.findMany({
    where: {
      customerId: { in: ids },
      status: { in: [...ACTIVE_CASE_STATUSES] },
    },
    select: { customerId: true, service: { select: { name: true } } },
  });
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.customerId] ??= []).push(r.service.name);
  }
  return map;
}

/** The owner of each customer's most recent case (any status). */
export async function findLatestOwnerByCustomer(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await prisma.case.findMany({
    where: { customerId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { customerId: true, owner: { select: { fullName: true } } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (!map[r.customerId]) map[r.customerId] = r.owner.fullName;
  }
  return map;
}

/** The most recent follow-up date per customer (across all their cases). */
export async function findLatestFollowUpByCustomer(
  ids: string[],
): Promise<Record<string, Date>> {
  if (ids.length === 0) return {};
  const rows = await prisma.followUp.findMany({
    where: { case: { customerId: { in: ids } } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, case: { select: { customerId: true } } },
  });
  const map: Record<string, Date> = {};
  for (const r of rows) {
    if (!map[r.case.customerId]) map[r.case.customerId] = r.createdAt;
  }
  return map;
}

// --- Stats for the customer list header (C-3) -------------------------------

export async function countCustomers(): Promise<number> {
  return prisma.customer.count();
}

export async function countCustomersByStatus(status: boolean): Promise<number> {
  return prisma.customer.count({ where: { status } });
}

/**
 * Distinct customers who have at least one ACTIVE period expiring within the
 * given window (today .. today+days). Computed at read time (rule 2).
 */
export async function countCustomersNearRenewal(days: number): Promise<number> {
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + days);
  const rows = await prisma.period.findMany({
    where: {
      status: "ACTIVE",
      expiryDate: { not: null, gte: today, lte: until },
    },
    select: { case: { select: { customerId: true } } },
  });
  const ids = new Set(rows.map((r) => r.case.customerId));
  return ids.size;
}

// --- Filter dropdown options ------------------------------------------------

/** All active services, for the list's service filter dropdown. */
export async function listActiveServiceOptions(): Promise<
  { id: string; name: string }[]
> {
  return prisma.service.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** All active employees, for the list's employee filter dropdown. */
export async function listActiveEmployeeOptions(): Promise<
  { id: string; fullName: string }[]
> {
  return prisma.employee.findMany({
    where: { status: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}

// --- Customer page: cases + follow-ups -------------------------------------

export type CaseWithDetail = {
  id: string;
  number: string;
  status: string;
  service: { name: string };
  periods: {
    indexNumber: number;
    status: string;
    totalAmount: bigint | null;
    payments: { amount: bigint }[];
    stages: { order: number; status: string; title: string }[];
  }[];
};

/** All of a customer's cases with the data needed to compute balance + progress. */
export async function findCasesByCustomer(customerId: string): Promise<CaseWithDetail[]> {
  return prisma.case.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      service: { select: { name: true } },
      periods: {
        orderBy: { indexNumber: "desc" },
        select: {
          indexNumber: true,
          status: true,
          totalAmount: true,
          payments: { select: { amount: true } },
          stages: {
            orderBy: { order: "asc" },
            select: { order: true, status: true, title: true },
          },
        },
      },
    },
  });
}

export type FollowUpRow = {
  id: string;
  note: string | null;
  createdAt: Date;
  case: { number: string };
  result: { title: string };
  createdBy: { fullName: string };
};

/** The customer's follow-up timeline across all their cases, newest first. */
export async function findFollowUpsByCustomer(customerId: string): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: { case: { customerId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      note: true,
      createdAt: true,
      case: { select: { number: true } },
      result: { select: { title: true } },
      createdBy: { select: { fullName: true } },
    },
  });
}