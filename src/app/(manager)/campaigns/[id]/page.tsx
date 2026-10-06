import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { toPersianDigits } from "@/lib/digits";
import {
  canManageCampaigns,
  canSendCampaign,
  canCancelCampaign,
  getCampaignDetail,
  CampaignSendPanel,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE,
  RECIPIENT_STATUS_LABELS,
  RECIPIENT_STATUS_BADGE,
} from "@/modules/campaigns";

// Campaign detail. Shows filter, body, status, and the recipient list with
// per-recipient outcome. A send/cancel panel is shown according to permission.

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!canManageCampaigns(user)) redirect("/dashboard");

  const { id } = await params;
  const c = await getCampaignDetail(user, id);
  if (!c) notFound();

  const sendable = c.status === "DRAFT" || c.status === "SCHEDULED";
  const cancellable =
    c.status === "DRAFT" || c.status === "SCHEDULED" || c.status === "RUNNING";

  return (
    <main className="mx-auto w-full px-4 py-8">
      <div className="mb-4">
        <Link href="/campaigns" className="text-sm text-primary hover:underline">
          ← بازگشت به کمپین‌ها
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">{c.name}</h1>
          <span
            className={`rounded-badge px-2.5 py-0.5 text-xs ${CAMPAIGN_STATUS_BADGE[c.status]}`}
          >
            {CAMPAIGN_STATUS_LABELS[c.status]}
          </span>
        </div>
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
            <dt className="text-xs text-text-secondary">سازنده</dt>
            <dd className="mt-1 text-sm text-text">{c.createdByName}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">زمان‌بندی</dt>
            <dd className="mt-1 text-sm text-text" dir="ltr">
              {c.scheduledAt ? toPersianDigits(c.scheduledAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">تعداد گیرنده</dt>
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
          <div>
            <dt className="text-xs text-text-secondary">ناموفق</dt>
            <dd className="mt-1 text-sm text-error" dir="ltr">
              {toPersianDigits(String(c.failedCount))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-4 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-sm font-bold text-text">متن پیام</h2>
        <p className="whitespace-pre-wrap text-sm text-text">{c.body}</p>
      </section>

      <section className="mb-6 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-text">عملیات</h2>
        <CampaignSendPanel
          campaignId={c.id}
          canSend={canSendCampaign(user)}
          canCancel={canCancelCampaign(user)}
          sendable={sendable}
          cancellable={cancellable}
          recipientCount={c.recipientCount}
        />
      </section>

      <section className="rounded-card border border-border bg-card shadow-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-bold text-text">
          گیرندگان
        </h2>
        {c.recipients.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">
            هنوز گیرنده‌ای شناسایی نشده است. با زدن «ارسال کمپین»، فهرست ساخته می‌شود.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-page text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">مشتری</th>
                  <th className="px-4 py-3 font-medium">موبایل</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">خطا</th>
                  <th className="px-4 py-3 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody>
                {c.recipients.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-text">{r.customerName}</td>
                    <td className="px-4 py-3 text-text-secondary" dir="ltr">
                      {toPersianDigits(r.mobile)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-badge px-2 py-0.5 text-xs ${RECIPIENT_STATUS_BADGE[r.status]}`}
                      >
                        {RECIPIENT_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-error break-words">
                      {r.error ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary" dir="ltr">
                      {r.processedAt ? toPersianDigits(r.processedAt) : "—"}
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