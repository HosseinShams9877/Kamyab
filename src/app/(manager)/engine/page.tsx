import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listRecentRuns,
  RunEngineButton,
  getSmsLog,
  SmsLogPanel,
  type EngineRunView,
} from "@/modules/engine";
import { toPersianDigits } from "@/lib/digits";

// The automatic-engine page (C-14). A read-only, server-rendered view of the
// most recent engine runs — plus a manual "run now" button, and the SMS log so
// a failing delivery can be diagnosed without leaving this page. The engine is
// normally triggered OUT of band (external scheduler → POST /api/engine/run, or
// the CLI). Authorization mirrors the settings section (rule 3).
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
  { key: "campaignsProcessed", label: "کمپین پردازش‌شده" },
  { key: "campaignsSent", label: "پیام کمپین" },
];

export default async function EnginePage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "settings.view")) redirect("/dashboard");

  const [runs, smsLog] = await Promise.all([listRecentRuns(), getSmsLog()]);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-text">موتور خودکار</h1>
          <p className="text-sm text-text-secondary">
            فهرست آخرین اجراهای موتور خودکار و لاگ پیامک‌ها. اجرای خودکار موتور
            توسط زمان‌بند بیرونی انجام می‌شود؛ در صورت نیاز می‌توانید موتور را
            دستی اجرا کنید.
          </p>
        </div>
        <RunEngineButton />
      </div>

      {/* Run log */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-text">اجراهای موتور</h2>
        {runs.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-6 text-center shadow-card">
            <p className="text-sm text-text-secondary">
              هنوز هیچ اجرایی ثبت نشده است. زمان‌بند را طبق راهنمای نصب پیکربندی
              کنید.
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
                    <span className="rounded-control bg-error-bg px-2 py-1 text-xs text-error">
                      {toPersianDigits(String(run.errors))} خطا
                    </span>
                  ) : (
                    <span className="rounded-control bg-success-bg px-2 py-1 text-xs text-success">
                      بدون خطا
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
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
                  <div className="mt-4 rounded-control border border-error bg-error-bg p-3">
                    <p className="mb-1 text-xs font-medium text-error">
                      جزئیات خطا
                    </p>
                    <ul className="space-y-1 text-xs text-error">
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
      </section>

      {/* SMS log */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-text">لاگ پیامک‌ها</h2>
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <SmsLogPanel log={smsLog} />
        </div>
      </section>
    </main>
  );
}