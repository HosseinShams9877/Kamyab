import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { toPersianDigits } from "@/lib/digits";
import {
  canManageCampaigns,
  getCampaignDetail,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE,
  RECIPIENT_STATUS_LABELS,
  RECIPIENT_STATUS_BADGE,
} from "@/modules/campaigns";

// Employee read-only view of a campaign.

export const dynamic = "force-dynamic";

export default async function EmployeeCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManageCampaigns(user)) redirect("/employee");

  const { id } = await params;
  const c = await getCampaignDetail(user, id);
  if (!c) notFound();

  return (
    <main className="mx-auto w-full px-4 py-8">
      <div className="mb-4">
        <Link
          href="/employee/campaigns"
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به کمپین‌ها
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text">{c.name}</h1>
        <span
          className={`rounded-badge px-2.5 py-0.5 text-xs ${CAMPAIGN_STATUS_BADGE[c.status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[c.status]}
        </span>
      </div>

      <section className="mb-4 rounded-card border border-border bg-card p-5 shadow-card">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-text-secondary">کانال</dt>
            <dd className="mt-1 text-sm text-text">
              {CAMPAIGN_CHANNEL_LABELS[c.channel]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">گیرندگان</dt>
            <dd className="mt-1 text-sm text-text" dir="ltr">
              {toPersianDigits(String(c.recipientCount))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">ارسال‌شده</dt>
            <dd className="mt-1 text-sm text-success" dir="ltr">
              {toPersianDigits(String(c.sentCount))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-4 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-sm font-bold text-text">متن پیام</h2>
        <p className="whitespace-pre-wrap text-sm text-text">{c.body}</p>
      </section>

      <section className="rounded-card border border-border bg-card shadow-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-bold text-text">
          گیرندگان
        </h2>
        {c.recipients.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            هنوز گیرنده‌ای شناسایی نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-right text-sm">
              <thead className="bg-page text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">مشتری</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {c.recipients.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-text">{r.customerName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-badge px-2 py-0.5 text-xs ${RECIPIENT_STATUS_BADGE[r.status]}`}
                      >
                        {RECIPIENT_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}