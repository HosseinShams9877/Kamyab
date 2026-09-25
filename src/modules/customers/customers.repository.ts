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

export async function countCustomerCases(id: string): Promise<number> {
  return prisma.case.count({ where: { customerId: id } });
}

// --- List ------------------------------------------------------------------

export type ListQuery = {
  q: string;
  type: CustomerType | null;
  status: boolean | null;
  city: string | null;
  sort: "newest" | "name" | "cases";
  skip: number;
  take: number;
};

function buildWhere(query: ListQuery): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.status !== null) where.status = query.status;
  if (query.city) where.city = query.city;
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
