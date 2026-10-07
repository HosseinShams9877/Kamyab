import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  RegistrationPeriodInput,
  RenewPeriodInput,
  ApplyStageActionArgs,
  AddExceptionalStageArgs,
  MoveStageArgs,
} from "./periods.types";

// ALL Prisma access for the periods domain lives here (rule 9): Period and the
// CaseStage rows bound to a period. Called only by periods.service and, for the
// case-creation transaction, through the tx-aware seam below (invoked on the
// cases module's transaction — rule 4). No Persian text in this layer; it deals
// in ids, Date objects, and raw columns.

export async function createRegistrationPeriodTx(
  tx: Prisma.TransactionClient,
  input: RegistrationPeriodInput,
): Promise<{ id: string }> {
  const period = await tx.period.create({
    data: {
      caseId: input.caseId,
      indexNumber: 1,
      status: "ACTIVE",
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      totalAmount: input.totalAmount,
      followUpStatus: "NOT_FOLLOWED_UP",
    },
    select: { id: true },
  });

  if (input.stages.length > 0) {
    const now = new Date();
    await tx.caseStage.createMany({
      data: input.stages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({
          periodId: period.id,
          title: s.title,
          order: s.order,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
          startedAt: i === 0 ? now : null,
          attemptCount: 0,
          isExceptional: false,
        })),
    });
  }

  return period;
}

// --- Renewal (C-9) ----------------------------------------------------------

export async function renewPeriodTx(
  tx: Prisma.TransactionClient,
  input: RenewPeriodInput,
): Promise<{ id: string }> {
  await tx.period.update({
    where: { id: input.previousPeriodId },
    data: { status: "RENEWED" },
  });

  const period = await tx.period.create({
    data: {
      caseId: input.caseId,
      indexNumber: input.indexNumber,
      status: "ACTIVE",
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      totalAmount: input.totalAmount,
      followUpStatus: "NOT_FOLLOWED_UP",
    },
    select: { id: true },
  });

  if (input.stages.length > 0) {
    const now = new Date();
    await tx.caseStage.createMany({
      data: input.stages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({
          periodId: period.id,
          title: s.title,
          order: s.order,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
          startedAt: i === 0 ? now : null,
          attemptCount: 0,
          isExceptional: false,
        })),
    });
  }

  return period;
}

export async function setPeriodStatusTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  status: string,
): Promise<void> {
  await tx.period.update({ where: { id: periodId }, data: { status } });
}

export async function findRenewablePeriod(caseId: string): Promise<{
  id: string;
  indexNumber: number;
  expiryDate: Date | null;
  followUpStatus: string;
} | null> {
  return prisma.period.findFirst({
    where: { caseId, status: "ACTIVE" },
    orderBy: { indexNumber: "desc" },
    select: { id: true, indexNumber: true, expiryDate: true, followUpStatus: true },
  });
}

export async function findPeriodLifecycle(periodId: string): Promise<{
  caseId: string;
  status: string;
  followUpStatus: string;
  expiryDate: Date | null;
  indexNumber: number;
} | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: {
      caseId: true,
      status: true,
      followUpStatus: true,
      expiryDate: true,
      indexNumber: true,
    },
  });
}

export type RenewalQueueRow = {
  id: string;
  indexNumber: number;
  status: string;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  followUpStatus: string;
  payments: { amount: bigint }[];
  case: {
    id: string;
    number: string;
    ownerId: string;
    owner: { fullName: string };
    service: { name: string };
    customer: {
      type: string;
      fullName: string | null;
      companyName: string | null;
      mobile: string;
    };
  };
};

export async function findRenewalsQueue(): Promise<RenewalQueueRow[]> {
  return prisma.period.findMany({
    where: {
      status: { in: ["ACTIVE", "ABANDONED", "RENEWED"] },
      case: { status: { not: "CANCELLED" } },
    },
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      indexNumber: true,
      status: true,
      expiryDate: true,
      totalAmount: true,
      followUpStatus: true,
      payments: { select: { amount: true } },
      case: {
        select: {
          id: true,
          number: true,
          ownerId: true,
          owner: { select: { fullName: true } },
          service: { select: { name: true } },
          customer: {
            select: { type: true, fullName: true, companyName: true, mobile: true },
          },
        },
      },
    },
  });
}

// --- Engine seams (C-14 / Phase 15) -----------------------------------------

export type ReminderCandidateRow = {
  id: string;
  expiryDate: Date | null;
  case: {
    number: string;
    ownerId: string;
    service: {
      name: string;
      reminderRules: { id: string; daysBefore: number; channel: string; recipient: string }[];
    };
    customer: { type: string; fullName: string | null; companyName: string | null; mobile: string };
  };
};

export async function findReminderCandidates(): Promise<ReminderCandidateRow[]> {
  return prisma.period.findMany({
    where: {
      status: "ACTIVE",
      expiryDate: { not: null },
      case: {
        status: { not: "CANCELLED" },
        service: { reminderRules: { some: { active: true } } },
      },
    },
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      expiryDate: true,
      case: {
        select: {
          number: true,
          ownerId: true,
          service: {
            select: {
              name: true,
              reminderRules: {
                where: { active: true },
                select: { id: true, daysBefore: true, channel: true, recipient: true },
              },
            },
          },
          customer: {
            select: { type: true, fullName: true, companyName: true, mobile: true },
          },
        },
      },
    },
  });
}

export async function abandonPeriods(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await prisma.period.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ABANDONED" },
  });
  return res.count;
}

// --- Reads (case page shell, C-5) ------------------------------------------

export type PeriodWithDetail = {
  id: string;
  indexNumber: number;
  status: string;
  startDate: Date;
  expiryDate: Date | null;
  totalAmount: bigint | null;
  followUpStatus: string;
  stages: {
    id: string;
    title: string;
    order: number;
    status: string;
    isExceptional: boolean;
    startedAt: Date | null;
    endedAt: Date | null;
    dueDate: Date | null;
    attemptCount: number;
    note: string | null;
    lastChangedBy: { fullName: string } | null;
  }[];
  payments: { amount: bigint }[];
};

const PERIOD_SELECT = {
  id: true,
  indexNumber: true,
  status: true,
  startDate: true,
  expiryDate: true,
  totalAmount: true,
  followUpStatus: true,
  stages: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      status: true,
      isExceptional: true,
      startedAt: true,
      endedAt: true,
      dueDate: true,
      attemptCount: true,
      note: true,
      lastChangedBy: { select: { fullName: true } },
    },
  },
  payments: { select: { amount: true } },
} satisfies Prisma.PeriodSelect;

export async function findPeriodsByCase(
  caseId: string,
): Promise<PeriodWithDetail[]> {
  return prisma.period.findMany({
    where: { caseId },
    orderBy: { indexNumber: "desc" },
    select: PERIOD_SELECT,
  });
}

// --- Stage engine reads (C-6) ----------------------------------------------

export async function findStageForAction(stageId: string): Promise<{
  periodId: string;
  caseId: string;
  status: string;
  title: string;
  isExceptional: boolean;
  attemptCount: number;
} | null> {
  const row = await prisma.caseStage.findUnique({
    where: { id: stageId },
    select: {
      periodId: true,
      status: true,
      title: true,
      isExceptional: true,
      attemptCount: true,
      period: { select: { caseId: true } },
    },
  });
  if (!row) return null;
  return {
    periodId: row.periodId,
    caseId: row.period.caseId,
    status: row.status,
    title: row.title,
    isExceptional: row.isExceptional,
    attemptCount: row.attemptCount,
  };
}

export async function findPeriodForAdd(
  periodId: string,
): Promise<{ caseId: string; status: string } | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: { caseId: true, status: true },
  });
}

// --- Financial seams (C-7) --------------------------------------------------

export async function findPeriodCase(
  periodId: string,
): Promise<{ caseId: string } | null> {
  return prisma.period.findUnique({
    where: { id: periodId },
    select: { caseId: true },
  });
}

export async function setPeriodTotalTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  totalAmount: bigint | null,
): Promise<void> {
  await tx.period.update({
    where: { id: periodId },
    data: { totalAmount },
  });
}

export async function findActivePeriod(
  caseId: string,
): Promise<{ id: string; followUpStatus: string; status: string } | null> {
  return prisma.period.findFirst({
    where: { caseId, status: "ACTIVE" },
    select: { id: true, followUpStatus: true, status: true },
    orderBy: { indexNumber: "desc" },
  });
}

export async function findCurrentPeriod(
  caseId: string,
): Promise<{ id: string; indexNumber: number; status: string } | null> {
  return prisma.period.findFirst({
    where: { caseId },
    select: { id: true, indexNumber: true, status: true },
    orderBy: { indexNumber: "desc" },
  });
}

export async function setPeriodFollowUpTx(
  tx: Prisma.TransactionClient,
  periodId: string,
  data: { followUpStatus: string; status?: string },
): Promise<void> {
  await tx.period.update({
    where: { id: periodId },
    data: {
      followUpStatus: data.followUpStatus,
      ...(data.status ? { status: data.status } : {}),
    },
  });
}

// --- Stage engine writes (tx-aware, run on the cases module's transaction) --

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "REJECTED"];

export async function applyStageActionTx(
  tx: Prisma.TransactionClient,
  args: ApplyStageActionArgs,
): Promise<void> {
  const stage = await tx.caseStage.findUnique({
    where: { id: args.stageId },
    select: { id: true, periodId: true, startedAt: true },
  });
  if (!stage) throw new Error("stage not found");
  const now = new Date();
  const by = args.actorId;

  switch (args.op) {
    case "start":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", startedAt: stage.startedAt ?? now, lastChangedById: by },
      });
      break;
    case "done":
    case "not_needed": {
      await tx.caseStage.update({
        where: { id: stage.id },
        data: {
          status: args.op === "done" ? "DONE" : "NOT_NEEDED",
          endedAt: now,
          lastChangedById: by,
        },
      });
      const siblings = await tx.caseStage.findMany({
        where: { periodId: stage.periodId },
        orderBy: { order: "asc" },
        select: { id: true, status: true, startedAt: true },
      });
      const next = siblings.find((s) => OPEN_STATUSES.includes(s.status));
      if (next && next.status === "PENDING") {
        await tx.caseStage.update({
          where: { id: next.id },
          data: { status: "IN_PROGRESS", startedAt: next.startedAt ?? now, lastChangedById: by },
        });
      }
      break;
    }
    case "reject":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: {
          status: "REJECTED",
          attemptCount: { increment: 1 },
          note: args.note,
          lastChangedById: by,
        },
      });
      break;
    case "reopen":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", endedAt: null, lastChangedById: by },
      });
      break;
    case "note":
      await tx.caseStage.update({
        where: { id: stage.id },
        data: { note: args.note, lastChangedById: by },
      });
      break;
  }
}

export async function addExceptionalStageTx(
  tx: Prisma.TransactionClient,
  args: AddExceptionalStageArgs,
): Promise<void> {
  const max = await tx.caseStage.aggregate({
    where: { periodId: args.periodId },
    _max: { order: true },
  });
  await tx.caseStage.create({
    data: {
      periodId: args.periodId,
      title: args.title,
      order: (max._max.order ?? 0) + 1,
      status: "PENDING",
      attemptCount: 0,
      isExceptional: true,
      lastChangedById: args.actorId,
    },
  });
}

export async function deleteStageTx(
  tx: Prisma.TransactionClient,
  stageId: string,
): Promise<void> {
  await tx.caseStage.delete({ where: { id: stageId } });
}

export async function moveStageTx(
  tx: Prisma.TransactionClient,
  args: MoveStageArgs,
): Promise<void> {
  const stage = await tx.caseStage.findUnique({
    where: { id: args.stageId },
    select: { id: true, periodId: true, order: true },
  });
  if (!stage) throw new Error("stage not found");
  const siblings = await tx.caseStage.findMany({
    where: { periodId: stage.periodId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const idx = siblings.findIndex((s) => s.id === stage.id);
  const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  await tx.caseStage.update({ where: { id: stage.id }, data: { order: other.order } });
  await tx.caseStage.update({ where: { id: other.id }, data: { order: stage.order } });
}

// --- Stage engine: completion check -----------------------------------------

export async function periodHasOpenStages(
  tx: Prisma.TransactionClient,
  periodId: string,
): Promise<boolean> {
  const open = await tx.caseStage.count({
    where: {
      periodId,
      status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] },
    },
  });
  return open > 0;
}

// --- Stage due dates (تب تنظیمات مراحل) ------------------------------------

export async function setStageDueDateTx(
  tx: Prisma.TransactionClient,
  stageId: string,
  dueDate: Date | null,
): Promise<void> {
  await tx.caseStage.update({
    where: { id: stageId },
    data: { dueDate },
  });
}

export async function findStageForDueDate(stageId: string): Promise<{
  caseId: string;
  periodId: string;
  status: string;
} | null> {
  const row = await prisma.caseStage.findUnique({
    where: { id: stageId },
    select: { periodId: true, status: true, period: { select: { caseId: true } } },
  });
  if (!row) return null;
  return {
    caseId: row.period.caseId,
    periodId: row.periodId,
    status: row.status,
  };
}

export type StageDueCandidateRow = {
  id: string;
  title: string;
  order: number;
  dueDate: Date | null;
  periodId: string;
  period: {
    case: {
      id: string;
      number: string;
      ownerId: string;
      customer: {
        type: string;
        fullName: string | null;
        companyName: string | null;
        mobile: string;
      };
    };
  };
};

export async function findStageDueCandidates(): Promise<StageDueCandidateRow[]> {
  return prisma.caseStage.findMany({
    where: {
      dueDate: { not: null },
      status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] },
      period: {
        case: { status: { not: "CANCELLED" } },
      },
    },
    select: {
      id: true,
      title: true,
      order: true,
      dueDate: true,
      periodId: true,
      period: {
        select: {
          case: {
            select: {
              id: true,
              number: true,
              ownerId: true,
              customer: {
                select: {
                  type: true,
                  fullName: true,
                  companyName: true,
                  mobile: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createStageReminderLog(args: {
  stageId: string;
  daysBefore: number;
  channel: string;
}): Promise<void> {
  await prisma.stageReminderLog.create({
    data: {
      stageId: args.stageId,
      daysBefore: args.daysBefore,
      channel: args.channel,
    },
  });
}