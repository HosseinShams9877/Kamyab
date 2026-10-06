import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AudienceFilter } from "./campaigns.types";

// ALL Prisma access for the campaigns domain. Cross-module reads (customers,
// services, employees) go through the service layer.

/** Insert a new campaign. */
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

/** A campaign's core row for auth + status decisions. */
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

/** A paginated list of campaigns, newest first. */
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

/** A single campaign with recipients (for the detail page). */
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

/** Resolve an audience filter into a Customer[] using the filter's rules. */
export async function resolveAudience(filter: AudienceFilter) {
  const where: Prisma.CustomerWhereInput = { status: true };

  if (filter.customerType) where.type = filter.customerType;
  if (filter.city) where.city = { contains: filter.city };

  if (filter.serviceIds && filter.serviceIds.length > 0) {
    where.cases = { some: { serviceId: { in: filter.serviceIds } } };
  }

  if (filter.hasActiveCase) {
    where.cases = {
      some: { status: { in: ["NEW", "IN_PROGRESS"] } },
    };
  }

  return prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      fullName: true,
      companyName: true,
      mobile: true,
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
}

/** Bulk-insert recipients. Skips duplicates via unique constraint — idempotent. */
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

/** Queued recipients of a campaign (for the send phase). */
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

/** Recipient counts grouped by status for a campaign. */
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

/** All scheduled/running campaigns whose scheduledAt has come. */
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