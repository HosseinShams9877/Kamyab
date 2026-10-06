import { renderTemplate } from "@/modules/settings/lib/sms";
import * as repo from "./campaigns.repository";

// The campaign orchestrator runs INSIDE the automatic engine (C-14). It picks
// up SCHEDULED/RUNNING campaigns, dispatches each QUEUED recipient via SMS or
// internal notification, and closes the campaign when nothing is left QUEUED.

export type CampaignPorts = {
  getInstituteName(): Promise<string>;
  queueSms(args: {
    recipient: string;
    body: string;
    templateKey: string;
  }): Promise<string>;
  createNotification(args: {
    customerId: string;
    message: string;
  }): Promise<string | null>;
};

export type CampaignRunResult = {
  campaignsProcessed: number;
  campaignsCompleted: number;
  sent: number;
  failed: number;
};

export async function runCampaigns(
  ports: CampaignPorts,
  now: Date,
): Promise<CampaignRunResult> {
  const result: CampaignRunResult = {
    campaignsProcessed: 0,
    campaignsCompleted: 0,
    sent: 0,
    failed: 0,
  };

  const due = await repo.findDueCampaigns(now);
  const instituteName = await ports.getInstituteName();

  for (const campaign of due) {
    result.campaignsProcessed += 1;

    const queued = await repo.listQueuedRecipients(campaign.id);
    for (const r of queued) {
      try {
        const customerName =
          r.customer.type === "LEGAL"
            ? r.customer.companyName ?? ""
            : r.customer.fullName ?? "";

        const rendered = renderTemplate(campaign.body, {
          customerName,
          companyName: r.customer.type === "LEGAL" ? customerName : "",
          instituteName,
        });

        if (campaign.channel === "SMS") {
          const id = await ports.queueSms({
            recipient: r.mobile,
            body: rendered,
            templateKey: campaign.templateKey || "campaign",
          });
          await repo.markRecipientSent(r.id, id);
        } else {
          const id = await ports.createNotification({
            customerId: r.customerId,
            message: rendered,
          });
          if (id) await repo.markRecipientSent(r.id, undefined, id);
          else await repo.markRecipientSkipped(r.id, "گیرنده‌ای برای اعلان پیدا نشد.");
        }
        result.sent += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await repo.markRecipientFailed(r.id, msg);
        result.failed += 1;
      }
    }

    // Close the campaign when nothing is left QUEUED.
    const counts = await repo.countRecipientsByStatus(campaign.id);
    const remainingQueued = counts.QUEUED ?? 0;
    if (remainingQueued === 0) {
      await repo.markCampaignCompleted(campaign.id);
      result.campaignsCompleted += 1;
    }
  }

  return result;
}