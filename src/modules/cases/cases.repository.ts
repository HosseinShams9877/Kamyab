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

/** Active cases (NEW | IN_PROGRESS) as options for the task form's related-case
 *  picker (C-11). The customer's display name depends on their type. */
export async function findActiveCases(): Promise<
  {
    id: string;
    number: string;
    customer: { type: string; fullName: string | null; companyName: string | null };
  }[]
> {
  return prisma.case.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      number: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
    },
  });
}

// --- Case list, dashboard counts & receivables (C-2 / C-15 / Phase 16) ------
// Raw list read + counts for the cases list page and the dashboard indicators.
// Persian text and the balance/scope decisions stay in the service; this layer
// only shapes the Prisma query. The row carries every period's total + payments
// so the service can compute the balance at read time (rule 2).

const LIST_ACTIVE_STATUSES = ["NEW", "IN_PROGRESS"];

export type CaseListRow = {
  id: string;
  number: string;
  status: string;
  lastActivityAt: Date;
  customer: { type: string; fullName: string | null; companyName: string | null };
  service: { name: string };
  owner: { fullName: string };
  periods: {
    status: string;
    totalAmount: bigint | null;
    payments: { amount: bigint }[];
    stages: { order: number; status: string; title: string }[];
  }[];
};

/** List cases matching `where`, newest activity first, optionally paginated. */
export async function queryCaseRows(
  where: Prisma.CaseWhereInput,
  opts: { skip?: number; take?: number } = {},
): Promise<CaseListRow[]> {
  return prisma.case.findMany({
    where,
    orderBy: { lastActivityAt: "desc" },
    skip: opts.skip,
    take: opts.take,
    select: {
      id: true,
      number: true,
      status: true,
      lastActivityAt: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
      service: { select: { name: true } },
      owner: { select: { fullName: true } },
      periods: {
        select: {
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

export async function countCaseRows(where: Prisma.CaseWhereInput): Promise<number> {
  return prisma.case.count({ where });
}

/** Count active (NEW | IN_PROGRESS) cases, optionally for one owner (C-2). */
export async function countActiveCases(ownerId?: string): Promise<number> {
  return prisma.case.count({
    where: { status: { in: LIST_ACTIVE_STATUSES }, ...(ownerId ? { ownerId } : {}) },
  });
}

/** Count stale cases: active with no activity since `cutoff` (C-2, rule 2). */
export async function countStaleCases(cutoff: Date, ownerId?: string): Promise<number> {
  return prisma.case.count({
    where: {
      status: { in: LIST_ACTIVE_STATUSES },
      lastActivityAt: { lt: cutoff },
      ...(ownerId ? { ownerId } : {}),
    },
  });
}

// --- Case list stats (C-2 style, /cases header) -----------------------------

/** Active cases that still have at least one OPEN stage in their ACTIVE period. */
export async function countActiveWithOpenStage(
  ownerId?: string,
): Promise<number> {
  return prisma.case.count({
    where: {
      status: { in: LIST_ACTIVE_STATUSES },
      ...(ownerId ? { ownerId } : {}),
      periods: {
        some: {
          status: "ACTIVE",
          stages: { some: { status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] } } },
        },
      },
    },
  });
}

/** Cases with status COMPLETED whose updatedAt falls in [from, to). */
export async function countCompletedBetween(
  from: Date,
  to: Date,
  ownerId?: string,
): Promise<number> {
  return prisma.case.count({
    where: {
      status: "COMPLETED",
      updatedAt: { gte: from, lt: to },
      ...(ownerId ? { ownerId } : {}),
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

// --- Stage engine (C-6 / Phase 10) ------------------------------------------

/** The case fields a stage action needs: ownership (authorization) + status
 *  (blocked-when-cancelled, NEW→IN_PROGRESS promotion). Null when absent. */
export async function findCaseForStage(
  caseId: string,
): Promise<{ id: string; number: string; status: string; ownerId: string } | null> {
  return prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, number: true, status: true, ownerId: true },
  });
}

/** The case fields a renewal needs: ownership + status (authorization + the
 *  cancelled block) plus serviceId (to look up the renewal path + durations).
 *  Null when the case does not exist. */
export async function findCaseForRenewal(
  caseId: string,
): Promise<{ id: string; number: string; status: string; ownerId: string; serviceId: string } | null> {
  return prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, number: true, status: true, ownerId: true, serviceId: true },
  });
}

// --- Case mutation transaction (C-6 stages, C-7 financial) ------------------

export type CaseMutationTxArgs = {
  caseId: string;
  actorId: string;
  /** Whether the case was NEW and should be promoted to IN_PROGRESS (C-6 side
   *  effect #3 — only the five stage transitions promote; financial writes pass
   *  false, a payment never advances the path). */
  promoteFromNew: boolean;
  /** The domain-owned write (a periods stage transition, or a payment/period-
   *  total write from the payments module), injected so this repository never
   *  touches another module's tables (rule 9). */
  apply: (tx: Prisma.TransactionClient) => Promise<void>;
  historyAction: string;
  historyDetail: string;
};

/**
 * Run a case mutation + its case-level side effects in one transaction (rule 4):
 * the injected domain write, then the case's last-activity bump and optional
 * NEW→IN_PROGRESS promotion, then the history record. Shared by the stage engine
 * (C-6) and financial actions (C-7) — both need Case.lastActivityAt + an
 * ActivityHistory row, which are cases-owned tables.
 */
export async function caseMutationTx(args: CaseMutationTxArgs): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await args.apply(tx);
    await tx.case.update({
      where: { id: args.caseId },
      data: {
        lastActivityAt: new Date(),
        ...(args.promoteFromNew ? { status: "IN_PROGRESS" } : {}),
      },
    });
    await tx.activityHistory.create({
      data: {
        entityType: "Case",
        entityId: args.caseId,
        action: args.historyAction,
        actorId: args.actorId,
        detail: args.historyDetail,
      },
    });
  });
}

// --- Cancellation & restore (C-8 / Phase 14) --------------------------------
// Raw Case-row writes for the cancel/restore transactions, run on the caller's
// tx inside caseMutationTx's `apply` (rule 4). caseMutationTx's own outer update
// omits `status` when promoteFromNew is false, so the status set here survives.

/** Mark a case CANCELLED and stamp who/why/when (C-8). Tx-aware. */
export function setCaseCancelledTx(
  tx: Prisma.TransactionClient,
  args: { caseId: string; reasonId: string; note: string | null; cancelledById: string },
): Promise<unknown> {
  return tx.case.update({
    where: { id: args.caseId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReasonId: args.reasonId,
      cancellationNote: args.note,
      cancelledById: args.cancelledById,
    },
  });
}

/** Restore a cancelled case to IN_PROGRESS and clear the cancellation fields
 *  (C-8). Tx-aware. */
export function restoreCaseStatusTx(
  tx: Prisma.TransactionClient,
  caseId: string,
): Promise<unknown> {
  return tx.case.update({
    where: { id: caseId },
    data: {
      status: "IN_PROGRESS",
      cancelledAt: null,
      cancellationReasonId: null,
      cancellationNote: null,
      cancelledById: null,
    },
  });
}

/** The cancellation detail for a case's header (C-8): when, why, note, and who —
 *  reason title and canceller name joined. Null when the case does not exist. */
export async function findCancellationDetail(caseId: string): Promise<{
  cancelledAt: Date | null;
  note: string | null;
  reasonTitle: string | null;
  cancelledByName: string | null;
} | null> {
  const row = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      cancelledAt: true,
      cancellationNote: true,
      cancellationReason: { select: { title: true } },
      cancelledBy: { select: { fullName: true } },
    },
  });
  if (!row) return null;
  return {
    cancelledAt: row.cancelledAt,
    note: row.cancellationNote,
    reasonTitle: row.cancellationReason?.title ?? null,
    cancelledByName: row.cancelledBy?.fullName ?? null,
  };
}

/** Cancelled cases whose cancellation falls in [from, to) with their reason
 *  title, for the cancellation report (B-5). Aggregation is done in the service
 *  layer (a pure guard helper) so the report can be unit-tested. */
export async function findCancellationsInRange(
  from: Date,
  to: Date,
): Promise<{ reasonId: string | null; reasonTitle: string | null }[]> {
  const rows = await prisma.case.findMany({
    where: { status: "CANCELLED", cancelledAt: { gte: from, lt: to } },
    select: {
      cancellationReasonId: true,
      cancellationReason: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    reasonId: r.cancellationReasonId,
    reasonTitle: r.cancellationReason?.title ?? null,
  }));
}

// --- Change owner (C-5 header action) ---------------------------------------
// Raw Case-row writes + the Task reassignment, both tx-aware. The service runs
// them inside caseMutationTx's `apply` so the lastActivityAt bump and the
// ActivityHistory row happen in the same transaction (rule 4).

/** The fields an owner-change needs: current ownership + status (the cancelled
 *  block) + the display number for the notification. Null when absent. */
export async function findCaseForOwnerChange(caseId: string): Promise<{
  id: string;
  number: string;
  status: string;
  ownerId: string;
} | null> {
  return prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, number: true, status: true, ownerId: true },
  });
}

/** Count OPEN (non-archived) tasks attached to a case, for the dialog hint. */
export function countOpenTasksForCase(caseId: string): Promise<number> {
  return prisma.task.count({
    where: { caseId, status: "OPEN", archivedAt: null },
  });
}

/** Swap the case's owner. Tx-aware (runs inside caseMutationTx's `apply`). */
export function setCaseOwnerTx(
  tx: Prisma.TransactionClient,
  args: { caseId: string; newOwnerId: string },
): Promise<unknown> {
  return tx.case.update({
    where: { id: args.caseId },
    data: { ownerId: args.newOwnerId },
  });
}

/** Move every OPEN task of a case to a new owner. Tx-aware. Returns the count
 *  actually moved (idempotent-safe: re-running after a partial move just moves
 *  whatever is left). */
export async function moveOpenCaseTasksTx(
  tx: Prisma.TransactionClient,
  args: { caseId: string; newOwnerId: string },
): Promise<number> {
  const res = await tx.task.updateMany({
    where: { caseId: args.caseId, status: "OPEN" },
    data: { ownerId: args.newOwnerId },
  });
  return res.count;
}

/** Write the owner-change notification inside the caller's tx. */
export function notifyOwnerChangeTx(
  tx: Prisma.TransactionClient,
  args: { userId: string; message: string },
): Promise<unknown> {
  return tx.notification.create({
    data: { userId: args.userId, message: args.message },
  });
}

/** Write any user notification inside the caller's tx (used by cancel to
 *  always inform the case's owner, even when the case had no open task). */
export function notifyUserTx(
  tx: Prisma.TransactionClient,
  args: { userId: string; message: string },
): Promise<unknown> {
  return tx.notification.create({
    data: { userId: args.userId, message: args.message },
  });
}