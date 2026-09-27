import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for global search (C-16) lives here (rule 9). The service
// builds the permission/ownership-scoped `where` clauses and this layer runs the
// two capped queries. Persian text never appears here — it deals in raw rows.

export type CustomerSearchRow = {
  id: string;
  code: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  mobile: string;
  status: boolean;
};

export async function searchCustomers(
  where: Prisma.CustomerWhereInput,
  take: number,
): Promise<CustomerSearchRow[]> {
  return prisma.customer.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      type: true,
      fullName: true,
      companyName: true,
      mobile: true,
      status: true,
    },
  });
}

export type CaseSearchRow = {
  id: string;
  number: string;
  status: string;
  customer: { type: string; fullName: string | null; companyName: string | null };
  service: { name: string };
};

export async function searchCases(
  where: Prisma.CaseWhereInput,
  take: number,
): Promise<CaseSearchRow[]> {
  return prisma.case.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
      service: { select: { name: true } },
    },
  });
}
