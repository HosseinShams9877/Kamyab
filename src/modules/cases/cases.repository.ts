import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ALL Prisma access for the cases domain lives here (rule 9): the Case table and
// the case-page read. Persian text never appears in this layer — it deals in
// ids, Date objects, and raw columns. The registration transaction (rule 4)
// generates the per-Jalali-year case number, writes the Case row, then invokes
// caller-supplied closures for the cross-module tx writes (period + stages via
// the periods module, the customer birth-info patch via the customers module) so
// this repository never imports another module (rule 9). Notification and
// ActivityHistory are cross-cutting tables the owning transaction writes directly
// (employees precedent); their Persian/JSON payloads are built by the service and
// passed in, since they depend on the number generated inside the transaction.

export type CreateCaseTxArgs = {
  customerId: string;
  serviceId: string;
  ownerId: string;
  actorId: string;
  notes: string | null;
  jalaliYear: number;
  /** Create the first period + copied stages (periods.createRegistrationPeriodTx). */
  writePeriod: (tx: Prisma.TransactionClient, caseId: string) => Promise<void>;
  /** Backfill the customer's birth/founding date + greeting (customers seam). */
  writeBirthInfo: (tx: Prisma.TransactionClient) => Promise<void>;
  /** Owner notification text; receives the generated case number. */
  buildOwnerMessage: (caseNumber: string) => string;
  /** JSON-serialized ActivityHistory detail; receives the generated case number. */
  buildHistoryDetail: (caseNumber: string) => string;
};

/**
 * Register a case in one transaction. The 4-digit zero-padded suffix means a
 * lexical "desc" over one year's numbers is also the numeric order, so the next
 * sequence is (last suffix + 1). A unique collision from a race surfaces as
 * P2002, which the service retries.
 */
export async function createCaseTx(
  args: CreateCaseTxArgs,
): Promise<{ id: string; number: string }> {
  return prisma.$transaction(async (tx) => {
    const prefix = `PR-${args.jalaliYear}-`;
    const last = await tx.case.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
    const number = `${prefix}${String(seq).padStart(4, "0")}`;

    const created = await tx.case.create({
      data: {
        number,
        customerId: args.customerId,
        serviceId: args.serviceId,
        ownerId: args.ownerId,
        status: "NEW",
        notes: args.notes,
      },
      select: { id: true },
    });

    // Customer patch first (it may set birth/founding date), then the period +
    // stages, so every write is inside the one atomic step (rule 4).
    await args.writeBirthInfo(tx);
    await args.writePeriod(tx, created.id);

    await tx.notification.create({
      data: { userId: args.ownerId, message: args.buildOwnerMessage(number) },
    });
    await tx.activityHistory.create({
      data: {
        entityType: "Case",
        entityId: created.id,
        action: "case.created",
        actorId: args.actorId,
        detail: args.buildHistoryDetail(number),
      },
    });

    return { id: created.id, number };
  });
}

// --- Case page read (C-5 header) --------------------------------------------

export type CaseCoreRow = {
  id: string;
  number: string;
  status: string;
  customerId: string;
  ownerId: string;
  customer: { type: string; fullName: string | null; companyName: string | null };
  service: { name: string };
  owner: { fullName: string };
};

/** The case's core row + the related names the header needs. Periods (and the
 *  read-time progress/financials) are read separately through the periods
 *  module, keeping this query to the cases-owned tables + joined display names. */
export async function findCaseCore(id: string): Promise<CaseCoreRow | null> {
  return prisma.case.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      ownerId: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
      service: { select: { name: true } },
      owner: { select: { fullName: true } },
    },
  });
}

/** The customer's active flag + type, for register validation and to route the
 *  birth-info patch (NATURAL → birthDate, LEGAL → foundingDate). Null if absent. */
export async function findCustomerForRegister(
  id: string,
): Promise<{ status: boolean; type: string } | null> {
  return prisma.customer.findUnique({
    where: { id },
    select: { status: true, type: true },
  });
}

export async function ownerIsActive(id: string): Promise<boolean> {
  const row = await prisma.employee.findUnique({
    where: { id },
    select: { status: true },
  });
  return row?.status === true;
}
