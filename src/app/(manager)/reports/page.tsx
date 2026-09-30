import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCancellationReport } from "@/modules/cases";
import { CancellationReportForm } from "@/modules/cases/components/cancellation-report-form";
import { todayJalali, formatJalali, parseJalali } from "@/lib/jalali";
import { toPersianDigits, toEnglishDigits } from "@/lib/digits";

// The cancellation report (B-5 / C-8): within a chosen Jalali date range, the
// count of cancelled cases broken down by reason. Server component — it
// authorizes (rule 3, `reports.view`), reads the range from query params, and
// reads the aggregate through the cases service (which owns the pure per-reason
// tally). Dynamic: the range is a query param and "today" drives the default.
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "reports.view")) redirect("/dashboard");

  const { from: fromParam, to: toParam } = await searchParams;
  const today = todayJalali();
  const defaultTo = formatJalali(today, { persianDigits: false });
  const defaultFrom = formatJalali(
    { jy: today.jy, jm: today.jm, jd: 1 },
    { persianDigits: false },
  );

  const fromRaw = toEnglishDigits((fromParam ?? "").trim());
  const toRaw = toEnglishDigits((toParam ?? "").trim());
  const from = parseJalali(fromRaw) ? fromRaw : defaultFrom;
  const to = parseJalali(toRaw) ? toRaw : defaultTo;

  const report = await getCancellationReport(from, to);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">گزارش لغو پرونده‌ها</h1>

      <CancellationReportForm defaultFrom={from} defaultTo={to} />

      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-text-secondary">
            مجموع پرونده‌های لغوشده
          </h2>
          <span className="text-2xl font-bold text-text" dir="ltr">
            {toPersianDigits(String(report?.total ?? 0))}
          </span>
        </div>

        {report && report.byReason.length > 0 ? (
          <ul className="divide-y divide-border">
            {report.byReason.map((r) => (
              <li
                key={r.title}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-text break-words">{r.title}</span>
                <span className="text-text-secondary" dir="ltr">
                  {toPersianDigits(String(r.count))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-text-secondary">
            در این بازه پرونده‌ای لغو نشده است.
          </p>
        )}
      </section>
    </main>
  );
}