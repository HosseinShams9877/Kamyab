import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getCancellationReport,
  getActiveReceivables,
} from "@/modules/cases";
import { getRenewalDashboard } from "@/modules/periods";
import { listWorkloads } from "@/modules/employees";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
import { toJalali, formatJalali, todayJalali, addMonths, toGregorianDate } from "@/lib/jalali";

// Employee "reports" page (C-15): the manager reports, scoped to the current
// employee. The cancellation report is global (it aggregates by reason), but
// the receivables and near-renewals are filtered by ownerId = user.id.
export const dynamic = "force-dynamic";

export default async function EmployeeReportsPage() {
  const user = await requireUser();
  if (!can(user, "reports.view")) redirect("/employee");

  // Default: last Jalali month → today.
  const todayJ = todayJalali();
  const monthStartJ = { jy: todayJ.jy, jm: todayJ.jm, jd: 1 };
  const fromStr = formatJalali(monthStartJ, { persianDigits: false });
  const toStr = formatJalali(todayJ, { persianDigits: false });

  const [cancellationReport, receivables, renewalDashboard] = await Promise.all([
    getCancellationReport(fromStr, toStr),
    getActiveReceivables(user),
    getRenewalDashboard(user.id),
  ]);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">گزارش‌ها</h1>
        <p className="mt-1 text-sm text-text-secondary">
          نگاه یک‌نگاهه به عملکرد پرونده‌ها و تمدیدهای شما
        </p>
      </div>

      {/* Financial + near-renewals cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
          <div className="text-sm text-text-secondary">مطالبات معوق شما</div>
          <div className="mt-2 text-2xl font-bold text-text">
            {formatToman(receivables)}
          </div>
        </div>
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
          <div className="text-sm text-text-secondary">تمدیدهای نزدیک شما</div>
          <div className="mt-2 text-2xl font-bold text-warning">
            {toPersianDigits(String(renewalDashboard.nearCount))}
          </div>
        </div>
      </div>

      {/* Cancellation report */}
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-base font-bold text-text">
          گزارش لغو پرونده‌ها (این ماه)
        </h2>
        {!cancellationReport || cancellationReport.total === 0 ? (
          <p className="rounded-control bg-page px-4 py-6 text-center text-sm text-text-secondary">
            در این بازه پرونده‌ای لغو نشده است.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-text-secondary">
              مجموع: {toPersianDigits(String(cancellationReport.total))} پرونده
            </p>
            <ul className="divide-y divide-border rounded-control border border-border">
              {cancellationReport.byReason.map((r) => (
                <li
                  key={r.title}
                  className="flex items-center justify-between px-3 py-2.5 text-sm"
                >
                  <span className="text-text">{r.title}</span>
                  <span className="rounded-badge bg-page px-2.5 py-0.5 text-xs text-text-secondary">
                    {toPersianDigits(String(r.count))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}