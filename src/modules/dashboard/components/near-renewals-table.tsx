import Link from "next/link";
import type { RenewalRow } from "@/modules/periods";
import { toPersianDigits } from "@/lib/digits";

// The "near renewals" dashboard table (C-2): active periods expiring within 30
// days (abandoned periods already excluded by the service). Server component;
// each row opens its case. Empty state per spec: "تمدید نزدیکی وجود ندارد."

export function NearRenewalsTable({
  rows,
  allHref = "/renewals?tab=near",
}: {
  rows: RenewalRow[];
  allHref?: string;
}) {
  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-text">تمدیدهای نزدیک</h2>
        <Link href={allHref} className="text-sm text-primary hover:underline">
          مشاهدهٔ همه
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">پرونده</th>
              <th className="px-4 py-3 font-medium">مشتری</th>
              <th className="px-4 py-3 font-medium">خدمت</th>
              <th className="px-4 py-3 font-medium">تاریخ انقضا</th>
              <th className="px-4 py-3 font-medium">باقی‌مانده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.periodId} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/cases/${r.caseId}`} className="text-primary hover:underline" dir="ltr">
                    {toPersianDigits(r.caseNumber)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text break-words">{r.customerName}</td>
                <td className="px-4 py-3 text-text-secondary">{r.serviceName}</td>
                <td className="px-4 py-3 text-text-secondary" dir="ltr">
                  {r.expiryDate ? toPersianDigits(r.expiryDate) : "—"}
                </td>
                <td className="px-4 py-3 text-text">
                  {r.daysRemaining === null
                    ? "—"
                    : `${toPersianDigits(String(r.daysRemaining))} روز`}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  تمدید نزدیکی وجود ندارد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
