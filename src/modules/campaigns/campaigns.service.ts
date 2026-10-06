import { formatJalali, toJalali, parseJalali, toGregorianDate } from "@/lib/jalali";
import { toEnglishDigits } from "@/lib/digits";
import { getService, listActiveServiceOptions } from "@/modules/services";
import { listTemplates } from "@/modules/settings";
import { can, type Authorizable } from "@/modules/permissions";
import { renderTemplate } from "@/modules/settings/lib/sms";
import * as repo from "./campaigns.repository";
import type {
  AudienceFilter,
  CampaignDetail,
  CampaignFormData,
  CampaignListParams,
  CampaignListResult,
  CampaignRow,
  SendAttemptResult,
} from "./campaigns.types";
import type { CampaignCreateInput } from "./campaigns.schema";
import type { CampaignChannel, CampaignStatus, RecipientStatus } from "@/types/enums";
import {
  CAMPAIGN_FORBIDDEN,
  CAMPAIGN_NOT_FOUND,
  CAMPAIGN_NOT_SENDABLE,
  CAMPAIGN_NO_RECIPIENTS,
  SMS_TEMPLATE_REQUIRED,
  INTERNAL_BODY_REQUIRED,
} from "./campaigns.guards";

const PAGE_SIZE = 10;

function orNull(v: string | undefined | null): string | null {
  const s = v?.trim();
  return s ? s : null;
}

function parseFilter(raw: string): AudienceFilter {
  try {
    return JSON.parse(raw) as AudienceFilter;
  } catch {
    return {};
  }
}

function normalizeFilter(input: CampaignCreateInput["audienceFilter"]): AudienceFilter {
  const f: AudienceFilter = {};
  if (input.customerType) f.customerType = input.customerType;
  if (input.city) f.city = input.city.trim();
  if (input.serviceIds && input.serviceIds.length > 0) f.serviceIds = input.serviceIds;
  if (input.hasActiveCase !== undefined && input.hasActiveCase !== null) f.hasActiveCase = input.hasActiveCase;
  if (input.hasBalance !== undefined && input.hasBalance !== null) f.hasBalance = input.hasBalance;
  if (input.joinedAfter && input.joinedAfter.trim()) f.joinedAfter = toEnglishDigits(input.joinedAfter.trim());
  if (input.birthdayMonth != null) f.birthdayMonth = input.birthdayMonth;
  return f;
}

export function canManageCampaigns(user: Authorizable): boolean {
  return can(user, "campaigns.view");
}
export function canCreateCampaign(user: Authorizable): boolean {
  return can(user, "campaigns.create");
}
export function canEditCampaign(user: Authorizable): boolean {
  return can(user, "campaigns.edit");
}
export function canSendCampaign(user: Authorizable): boolean {
  return can(user, "campaigns.send");
}
export function canCancelCampaign(user: Authorizable): boolean {
  return can(user, "campaigns.cancel");
}

export async function getCampaignFormData(): Promise<CampaignFormData> {
  const [templates, services] = await Promise.all([
    listTemplates(),
    listActiveServiceOptions(),
  ]);
  return {
    templates: templates.map((t) => ({ eventKey: t.eventKey, body: t.body })),
    services: services.map((s) => ({ id: s.id, name: s.name })),
  };
}

export async function listCampaignsView(
  user: Authorizable,
  params: CampaignListParams,
): Promise<CampaignListResult> {
  if (!can(user, "campaigns.view")) {
    return { items: [], total: 0, page: 1, pageCount: 1, pageSize: PAGE_SIZE };
  }

  const where: any = {};
  if (params.q && params.q.trim()) {
    where.name = { contains: toEnglishDigits(params.q.trim()) };
  }
  if (params.status) where.status = params.status;

  const page = Math.max(1, params.page ?? 1);
  const { rows, total } = await repo.listCampaigns(where, {
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items: CampaignRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    channel: r.channel as CampaignChannel,
    status: r.status as CampaignStatus,
    scheduledAt: r.scheduledAt ? formatJalali(toJalali(r.scheduledAt), { persianDigits: false }) : null,
    startedAt: r.startedAt ? formatJalali(toJalali(r.startedAt), { persianDigits: false }) : null,
    finishedAt: r.finishedAt ? formatJalali(toJalali(r.finishedAt), { persianDigits: false }) : null,
    createdByName: r.createdBy.fullName,
    recipientCount: r._count.recipients,
    sentCount: 0,
    failedCount: 0,
    queuedCount: 0,
    createdAt: formatJalali(toJalali(r.createdAt), { persianDigits: false }),
  }));
  return { items, total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function getCampaignDetail(
  user: Authorizable,
  id: string,
): Promise<CampaignDetail | null> {
  if (!can(user, "campaigns.view")) return null;
  const c = await repo.findCampaignDetail(id);
  if (!c) return null;
  const counts = await repo.countRecipientsByStatus(id);
  return {
    id: c.id,
    name: c.name,
    channel: c.channel as CampaignChannel,
    status: c.status as CampaignStatus,
    scheduledAt: c.scheduledAt ? formatJalali(toJalali(c.scheduledAt), { persianDigits: false }) : null,
    startedAt: c.startedAt ? formatJalali(toJalali(c.startedAt), { persianDigits: false }) : null,
    finishedAt: c.finishedAt ? formatJalali(toJalali(c.finishedAt), { persianDigits: false }) : null,
    createdByName: c.createdBy.fullName,
    recipientCount: c.recipients.length,
    sentCount: counts.SENT ?? 0,
    failedCount: counts.FAILED ?? 0,
    queuedCount: counts.QUEUED ?? 0,
    createdAt: formatJalali(toJalali(c.createdAt), { persianDigits: false }),
    body: c.body,
    templateKey: c.templateKey,
    audienceFilter: parseFilter(c.audienceFilter),
    recipients: c.recipients.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName:
        r.customer.type === "LEGAL"
          ? r.customer.companyName ?? "—"
          : r.customer.fullName ?? "—",
      mobile: r.mobile,
      status: r.status as RecipientStatus,
      error: r.error,
      processedAt: r.processedAt
        ? formatJalali(toJalali(r.processedAt), { persianDigits: false })
        : null,
    })),
  };
}

export async function createCampaign(
  user: Authorizable,
  input: CampaignCreateInput,
): Promise<{ ok: true; id: string } | { ok: false; field?: string; message: string }> {
  if (!can(user, "campaigns.create")) {
    return { ok: false, message: CAMPAIGN_FORBIDDEN };
  }

  if (input.channel === "SMS" && !input.templateKey?.trim()) {
    return { ok: false, field: "templateKey", message: SMS_TEMPLATE_REQUIRED };
  }
  if (input.channel === "INTERNAL_NOTIFICATION" && !input.body.trim()) {
    return { ok: false, field: "body", message: INTERNAL_BODY_REQUIRED };
  }

  const filter = normalizeFilter(input.audienceFilter);
  const scheduledJ = input.scheduledAt ? parseJalali(input.scheduledAt) : null;
  const scheduledAt = scheduledJ ? toGregorianDate(scheduledJ) : null;

  const status = scheduledAt ? "SCHEDULED" : "DRAFT";

  const { id } = await repo.createCampaign({
    name: input.name,
    channel: input.channel,
    templateKey: input.templateKey?.trim() ?? "",
    body: input.body,
    audienceFilter: JSON.stringify(filter),
    scheduledAt,
    createdById: user.id,
    status,
  });

  return { ok: true, id };
}

/** Snapshot the current audience into CampaignRecipient rows. Idempotent. */
export async function snapshotAudience(
  user: Authorizable,
  campaignId: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  if (!can(user, "campaigns.send")) {
    return { ok: false, message: CAMPAIGN_FORBIDDEN };
  }
  const core = await repo.findCampaignCore(campaignId);
  if (!core) return { ok: false, message: CAMPAIGN_NOT_FOUND };

  const filter = parseFilter(core.audienceFilter);
  const customers = await repo.resolveAudience(filter);

  const rows = customers
    .filter((c) => c.mobile && c.mobile.trim())
    .map((c) => ({ customerId: c.id, mobile: c.mobile }));
  const { count } = await repo.createRecipients(campaignId, rows);
  return { ok: true, count };
}

/** Manually trigger a campaign send. Called from the API. */
export async function sendCampaign(
  user: Authorizable,
  campaignId: string,
): Promise<SendAttemptResult> {
  if (!can(user, "campaigns.send")) {
    return { ok: false, code: 403, message: CAMPAIGN_FORBIDDEN };
  }
  const core = await repo.findCampaignCore(campaignId);
  if (!core) return { ok: false, code: 404, message: CAMPAIGN_NOT_FOUND };
  if (!["DRAFT", "SCHEDULED"].includes(core.status)) {
    return { ok: false, code: 409, message: CAMPAIGN_NOT_SENDABLE };
  }

  const snapshot = await snapshotAudience(user, campaignId);
  if (!snapshot.ok) return { ok: false, code: 422, message: snapshot.message };
  if (snapshot.count === 0 && (await repo.countRecipientsByStatus(campaignId)).QUEUED === undefined) {
    return { ok: false, code: 422, message: CAMPAIGN_NO_RECIPIENTS };
  }

  await repo.markCampaignRunning(campaignId);
  return { ok: true, recipientCount: snapshot.count };
}

/** Cancel a running or scheduled campaign. */
export async function cancelCampaign(
  user: Authorizable,
  campaignId: string,
): Promise<{ ok: true } | { ok: false; code: 403 | 404 | 409; message: string }> {
  if (!can(user, "campaigns.cancel")) {
    return { ok: false, code: 403, message: CAMPAIGN_FORBIDDEN };
  }
  const core = await repo.findCampaignCore(campaignId);
  if (!core) return { ok: false, code: 404, message: CAMPAIGN_NOT_FOUND };
  if (core.status === "COMPLETED" || core.status === "CANCELLED") {
    return { ok: false, code: 409, message: "این کمپین پایان یافته است." };
  }
  await repo.markCampaignCancelled(campaignId);
  return { ok: true };
}