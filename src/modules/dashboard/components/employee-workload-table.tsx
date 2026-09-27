import type { WorkloadRow } from "@/modules/employees";
import { toPersianDigits } from "@/lib/digits";

// The employee-status / workload table (C-2, and the workload report). Server
// component. It carries NO action button — this is a workload-balancing view,
// not a performance scoreboard, which the MANDATORY caption below states
// verbatim (the note is a hard requirement of C-2).

export function EmployeeWorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-text">وضعیت کارمندان</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">کارمند</th>
              <th className="px-4 py-3 font-medium">دپارتمان</th>
              <th className="px-4 py-3 font-medium">پرونده‌های فعال</th>
              <th className="px-4 py-3 font-medium">کارهای امروز</th>
              <th className="px-4 py-3 font-medium">کارهای عقب‌افتاده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 text-text break-words">{e.fullName}</td>
                <td className="px-4 py-3 text-text-secondary">{e.department ?? "—"}</td>
                <td className="px-4 py-3 text-text">{toPersianDigits(String(e.activeCases))}</td>
                <td className="px-4 py-3 text-text">{toPersianDigits(String(e.todaysTasks))}</td>
                <td className={`px-4 py-3 ${e.overdueTasks > 0 ? "text-error" : "text-text"}`}>
                  {toPersianDigits(String(e.overdueTasks))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  کارمند فعالی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-text-secondary">
        این جدول برای کنترل بار کاری است، نه ارزیابی عملکرد.
      </p>
    </section>
  );
}
