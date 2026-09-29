import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { listRecentRuns, type EngineRunView } from "@/modules/engine";
import { toPersianDigits } from "@/lib/digits";

// The automatic-engine run log (C-14). A read-only, server-rendered view of the
// most recent engine runs so a manager can confirm the scheduler is firing and
// see what each run did. The engine itself is triggered OUT of band (an external
// scheduler calls POST /api/engine/run, or the CLI) — this page never runs it;
// it only reports. Authorization mirrors the settings section (rule 3):
// managers/supervisors with `settings.view`. Dynamic — it reflects live run rows.
export const dynamic = "force-dynamic";

/** The per-run tallies, in display order, with their Persian labels. */
const METRICS: { key: keyof EngineRunView; label: string }[] = [
  { key: "reminders", label: "یادآوری تمدید" },
  { key: "smsSent", label: "پیامک ارسال‌شده" },
  { key: "greetings", label: "تبریک" },
  { key: "archived", label: "بایگانی کار" },
  { key: "abandoned", label: "دوره رهاشده" },
  { key: "overdueAlerts", label: "هشدار کار عقب‌افتاده" },
  { key: "unfollowedAlerts", label: "هشدار پیگیری‌نشده" },
];

export default async function EnginePage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "settings.view")) redirect("/dashboard");

  const runs = await listRecentRuns();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-text">موتور خودکار</h1>
      <p className="mb-6 text-sm text-text-secondary">
        فهرست آخرین اجراهای موتور خودکار. اجرای موتور توسط زمان‌بند بیرونی انجام
        می‌شود؛ این صفحه فقط نتیجهٔ اجراها را نشان می‌دهد.
      </p>

      {runs.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6 text-center shadow-card">
          <p className="text-sm text-text-secondary">
            هنوز هیچ اجرایی ثبت نشده است. زمان‌بند را طبق راهنمای نصب پیکربندی کنید.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-text" dir="ltr">
                    {run.dateJalali}
                  </span>
                  <span className="text-xs text-text-secondary" dir="ltr">
                    {run.time}
                  </span>
                </div>
                {run.errors > 0 ? (
                  <span className="rounded-control bg-red-100 px-2 py-1 text-xs text-red-700">
                    {toPersianDigits(String(run.errors))} خطا
                  </span>
                ) : (
                  <span className="rounded-control bg-green-100 px-2 py-1 text-xs text-green-700">
                    بدون خطا
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {METRICS.map((m) => (
                  <div
                    key={m.key}
                    className="rounded-control border border-border bg-page px-3 py-2"
                  >
                    <dt className="text-xs text-text-secondary">{m.label}</dt>
                    <dd className="mt-1 text-lg font-bold text-text" dir="ltr">
                      {toPersianDigits(String(run[m.key] as number))}
                    </dd>
                  </div>
                ))}
              </dl>

              {run.errorDetails.length > 0 && (
                <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-3">
                  <p className="mb-1 text-xs font-medium text-red-700">جزئیات خطا</p>
                  <ul className="space-y-1 text-xs text-red-700">
                    {run.errorDetails.map((d, i) => (
                      <li key={i} dir="ltr" className="break-words">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
