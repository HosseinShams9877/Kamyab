import type { CampaignChannel, CampaignStatus, RecipientStatus } from "@/types/enums";

// Domain types for the campaigns module. Isomorphic — safe on client + server.

/** The structured audience filter. Extend carefully; the repository translates
 *  each field into a Prisma `where` clause on Customer. */
export type AudienceFilter = {
  customerType?: "NATURAL" | "LEGAL" | null;
  city?: string | null; // partial match, case-sensitive
  serviceIds?: string[]; // has at least one case on any of these services
  hasActiveCase?: boolean | null; // has ≥1 case with status NEW/IN_PROGRESS
  hasBalance?: boolean | null; // sum(balance) > 0 across active cases
  joinedAfter?: string | null; // Jalali "YYYY/MM/DD", ASCII
  birthdayMonth?: number | null; // 1..12 (Jalali)
};

/** A campaign row as shown in the list. */
export type CampaignRow = {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  scheduledAt: string | null; // Jalali
  startedAt: string | null;
  finishedAt: string | null;
  createdByName: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  queuedCount: number;
  createdAt: string;
};

/** One recipient row (for the detail page). */
export type CampaignRecipientRow = {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  status: RecipientStatus;
  error: string | null;
  processedAt: string | null;
};

/** Campaign detail for the page. */
export type CampaignDetail = CampaignRow & {
  body: string;
  templateKey: string;
  audienceFilter: AudienceFilter;
  recipients: CampaignRecipientRow[];
};

/** Form data the client form needs. */
export type CampaignFormData = {
  templates: { eventKey: string; body: string }[];
  services: { id: string; name: string }[];
};

export type CampaignListParams = {
  q?: string;
  status?: CampaignStatus | "";
  page?: number;
};

export type CampaignListResult = {
  items: CampaignRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** Result of one send attempt for a single recipient. */
export type SendAttemptResult =
  | { ok: true; recipientCount: number }
  | { ok: false; code: 400 | 403 | 404 | 409 | 422; message: string };