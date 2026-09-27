import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/modules/auth";
import { can, scopeByOwnership } from "@/modules/permissions";
import { CASE_STATUS_LABELS } from "@/modules/cases";
import type { CaseStatus } from "@/types/enums";
import { toEnglishDigits } from "@/lib/digits";
import * as repo from "./search.repository";
import {
  SEARCH_MIN_LENGTH,
  type SearchCaseHit,
  type SearchCustomerHit,
  type SearchResults,
} from "./search.types";

// Business logic for global search (C-16). The service is the module's only
// cross-module entry point: it authorizes (rule 3) — customers need
// `customers.view`; cases are scoped by ownership (a manager sees all, an
// employee only their own) — builds the search `where` clauses, and shapes the
// rows into presentation hits. Cancelled cases and deactivated customers are
// deliberately still findable, carrying their status.

const TAKE = 8;

/** Customer display name from a raw row (LEGAL → company, else full name). */
function customerName(row: {
  type: string;
  fullName: string | null;
  companyName: string | null;
  code: string;
}): string {
  const name = row.type === "LEGAL" ? row.companyName : row.fullName;
  return name ?? row.code;
}

function toCustomerHit(row: repo.CustomerSearchRow): SearchCustomerHit {
  return {
    id: row.id,
    code: row.code,
    displayName: customerName(row),
    mobile: row.mobile,
    active: row.status,
  };
}

function toCaseHit(row: repo.CaseSearchRow): SearchCaseHit {
  const status = row.status as CaseStatus;
  return {
    id: row.id,
    number: row.number,
    customerName: customerName({ ...row.customer, code: "" }),
    serviceName: row.service.name,
    status,
    statusLabel: CASE_STATUS_LABELS[status] ?? row.status,
  };
}

/**
 * Global search across customers and cases (C-16). Matches customer name /
 * company / mobile / national id / entity id / customer code, and case number /
 * service name / customer name. Digits are normalized to ASCII so a Persian-typed
 * mobile or case number still matches. Returns empty categories below the minimum
 * length or when the user may not see that category.
 */
export async function search(
  user: CurrentUser,
  rawQ: string,
): Promise<SearchResults> {
  const q = toEnglishDigits((rawQ ?? "").trim());
  const results: SearchResults = { customers: [], cases: [] };
  if (q.length < SEARCH_MIN_LENGTH) return results;

  const caseScope = scopeByOwnership(user, "cases");

  // Customers — visible with `customers.view`; an owner-scoped user (employee)
  // only finds customers related to their own cases, mirroring the list filter.
  if (can(user, "customers.view")) {
    const where: Prisma.CustomerWhereInput = {
      OR: [
        { fullName: { contains: q } },
        { companyName: { contains: q } },
        { mobile: { contains: q } },
        { nationalId: { contains: q } },
        { nationalEntityId: { contains: q } },
        { code: { contains: q } },
      ],
    };
    if (caseScope && "ownerId" in caseScope) {
      where.cases = { some: { ownerId: caseScope.ownerId } };
    }
    const rows = await repo.searchCustomers(where, TAKE);
    results.customers = rows.map(toCustomerHit);
  }

  // Cases — scoped by ownership; skipped entirely when the user has no case access.
  if (caseScope !== null) {
    const where: Prisma.CaseWhereInput = {
      OR: [
        { number: { contains: q } },
        { service: { is: { name: { contains: q } } } },
        { customer: { is: { fullName: { contains: q } } } },
        { customer: { is: { companyName: { contains: q } } } },
      ],
    };
    if ("ownerId" in caseScope) where.ownerId = caseScope.ownerId;
    const rows = await repo.searchCases(where, TAKE);
    results.cases = rows.map(toCaseHit);
  }

  return results;
}
