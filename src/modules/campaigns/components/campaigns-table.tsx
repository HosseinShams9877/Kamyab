"use client";

import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import type { CampaignRow } from "../campaigns.types";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE,
} from "../lib/labels";

// The campaigns list table. `basePath` chooses the detail-route prefix:
//   managers → "/campaigns"
//   employees → "/employee/campaigns"

export function CampaignsTable({
  items,
  basePath = "/campaigns",
}: {
  items: CampaignRow[];
  basePath?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
        هنوز کمپینی ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
      <table className="w-full min-w-[880px] text-right text-sm">
        <thead className="bg-page text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-medium">نام</th>
            <th className="px-4 py-3 font-medium">کانال</th>
            <th className="px-4 py-3 font-medium">وضعیت</th>
            <th className="px-4 py-3 font-medium">گیرندگان</th>
            <th className="px-4 py-3 font-medium">زمان‌بندی</th>
            <th className="px-4 py-3 font-medium">سازنده</th>
            <th className="px-4 py-3 font-medium">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-3 text-text font-medium">{c.name}</td>
              <td className="px-4 py-3 text-text-secondary">
                {CAMPAIGN_CHANNEL_LABELS[c.channel]}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-badge px-2 py-0.5 text-xs ${CAMPAIGN_STATUS_BADGE[c.status]}`}
                >
                  {CAMPAIGN_STATUS_LABELS[c.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary" dir="ltr">
                {toPersianDigits(String(c.recipientCount))}
              </td>
              <td className="px-4 py-3 text-text-secondary" dir="ltr">
                {c.scheduledAt ? toPersianDigits(c.scheduledAt) : "—"}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {c.createdByName}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`${basePath}/${c.id}`}
                  className="inline-flex min-h-[36px] items-center rounded-control border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-page"
                >
                  جزئیات
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}