import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toJalali, parseJalali, toGregorianDate } from "@/lib/jalali";
import type { AudienceFilter } from "./campaigns.types";

// ALL Prisma access for the campaigns domain.

export function createCampaign(data: {
  name: string;
  channel: string;
  templateKey: string;
  body: string;
  audienceFilter: string;
  scheduledAt: Date | null;
  createdById: string;
  status: string;
}) {
  return prisma.campaign.create({ data, select: { id: true } });
}

export function findCampaignCore(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      channel: true,
      templateKey: true,
      body: true,
      audienceFilter: true,
      status: true,
      scheduledAt: true,
      createdById: true,
    },
  });
}

export async function listCampaigns(
  where: Prisma.CampaignWhereInput,
  opts: { skip?: number; take?: number } = {},
) {
  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        name: true,
        channel: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
        _count: { select: { recipients: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);
  return { rows, total };
}

export function findCampaignDetail(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      channel: true,
      templateKey: true,
      body: true,
      audienceFilter: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      createdBy: { select: { fullName: true } },
      recipients: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          customerId: true,
          mobile: true,
          status: true,
          error: true,
          processedAt: true,
          customer: {
            select: { type: true, fullName: true, companyName: true },
          },
        },
      },
    },
  });
}

/**
 * Resolve an audience filter into a Customer[].
 * Prisma-expressible filters (type, city, serviceIds, hasActiveCase) run in the
 * DB. The rest (joinedAfter, hasBalance, birthdayMonth) run in-memory after the
 * fetch — acceptable at the institute's scale.
 */
export async function resolveAudience(filter: AudienceFilter) {
  const where: Prisma.CustomerWhereInput = { status: true };

  if (filter.customerType) where.type = filter.customerType;
  if (filter.city) where.city = { contains: filter.city };

  // Build the case-level constraint from an array of AND conditions so we never
  // overwrite `where.cases` when both filters apply.
  const caseConditions: Prisma.CaseWhereInput[] = [];
  if (filter.serviceIds && filter.serviceIds.length > 0) {
    caseConditions.push({ serviceId: { in: filter.serviceIds } });
  }
  if (filter.hasActiveCase) {
    caseConditions.push({ status: { in: ["NEW", "IN_PROGRESS"] } });
  }
  if (caseConditions.length > 0) {
    where.cases = { some: { AND: caseConditions } };
  }

  const rows = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      fullName: true,
      companyName: true,
      mobile: true,
      birthDate: true,
      foundingDate: true,
      createdAt: true,
      cases: {
        where: { status: { in: ["NEW", "IN_PROGRESS"] } },
        select: {
          periods: {
            select: {
              totalAmount: true,
              payments: { select: { amount: true } },
            },
          },
        },
      },
    },
  });

  return rows.filter((c) => {
    // joinedAfter: Customer.createdAt >= that Jalali date.
    if (filter.joinedAfter) {
      const j = parseJalali(filter.joinedAfter);
      if (j) {
        const from = toGregorianDate(j);
        if (c.createdAt < from) return false;
      }
    }

    // hasBalance: sum(totalAmount) - sum(payments) > 0 across active periods.
    if (filter.hasBalance) {
      let totalSum = 0;
      let paidSum = 0;
      let anyTotal = false;
      for (const cs of c.cases) {
        for (const p of cs.periods) {
          if (p.totalAmount !== null) {
            anyTotal = true;
            totalSum += Number(p.totalAmount);
          }
          for (const pay of p.payments) paidSum += Number(pay.amount);
        }
      }
      const balance = anyTotal ? totalSum - paidSum : 0;
      if (balance <= 0) return false;
    }

    // birthdayMonth: the Jalali month of the customer's birthDate (natural) or
    // foundingDate (legal) matches the requested month.
    if (filter.birthdayMonth) {
      const d = c.birthDate ?? c.foundingDate;
      if (!d) return false;
      const j = toJalali(d);
      if (j.jm !== filter.birthdayMonth) return false;
    }

    return true;
  });
}

export async function createRecipients(
  campaignId: string,
  rows: { customerId: string; mobile: string }[],
) {
  if (rows.length === 0) return { count: 0 };
  const res = await prisma.campaignRecipient.createMany({
    data: rows.map((r) => ({
      campaignId,
      customerId: r.customerId,
      mobile: r.mobile,
      status: "QUEUED",
    })),
    skipDuplicates: true,
  });
  return { count: res.count };
}

export function listQueuedRecipients(campaignId: string) {
  return prisma.campaignRecipient.findMany({
    where: { campaignId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      customerId: true,
      mobile: true,
      customer: { select: { type: true, fullName: true, companyName: true } },
    },
  });
}

export function markCampaignRunning(id: string) {
  return prisma.campaign.update({
    where: { id },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export function markCampaignCompleted(id: string) {
  return prisma.campaign.update({
    where: { id },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
}

export function markCampaignCancelled(id: string) {
  return prisma.campaign.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
}

export function markRecipientSent(id: string, smsMessageId?: string, notificationId?: string) {
  return prisma.campaignRecipient.update({
    where: { id },
    data: {
      status: "SENT",
      processedAt: new Date(),
      smsMessageId: smsMessageId ?? null,
      notificationId: notificationId ?? null,
    },
  });
}

export function markRecipientFailed(id: string, error: string) {
  return prisma.campaignRecipient.update({
    where: { id },
    data: { status: "FAILED", error, processedAt: new Date() },
  });
}

export function markRecipientSkipped(id: string, reason: string) {
  return prisma.campaignRecipient.update({
    where: { id },
    data: { status: "SKIPPED", error: reason, processedAt: new Date() },
  });
}

export async function countRecipientsByStatus(campaignId: string) {
  const rows = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

export function findDueCampaigns(now: Date) {
  return prisma.campaign.findMany({
    where: {
      OR: [
        { status: "SCHEDULED", scheduledAt: { lte: now } },
        { status: "RUNNING" },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    select: { id: true, status: true, channel: true, body: true, templateKey: true },
  });
}