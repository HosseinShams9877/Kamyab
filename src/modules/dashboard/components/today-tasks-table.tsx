import Link from "next/link";
import type { TaskRow } from "@/modules/tasks";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE } from "@/modules/tasks";
import { toPersianDigits } from "@/lib/digits";

// The "today's tasks" dashboard table (C-2): OPEN tasks due today. Server
// component; a task linked to a case opens it. Empty state per spec:
// "کاری برای امروز ثبت نشده."

export function TodayTasksTable({
  rows,
  allHref = "/tasks?tab=today",
  showOwner = true,
}: {
  rows: TaskRow[];
  allHref?: string;
  showOwner?: boolean;
}) {
  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-text">کارهای امروز</h2>
        <Link href={allHref} className="text-sm text-primary hover:underline">
          مشاهدهٔ همه
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">عنوان</th>
              <th className="px-4 py-3 font-medium">پرونده</th>
              {showOwner && <th className="px-4 py-3 font-medium">مسئول</th>}
              <th className="px-4 py-3 font-medium">اولویت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3 text-text break-words">{t.title}</td>
                <td className="px-4 py-3">
                  {t.caseId && t.caseNumber ? (
                    <Link href={`/cases/${t.caseId}`} className="text-primary hover:underline" dir="ltr">
                      {toPersianDigits(t.caseNumber)}
                    </Link>
                  ) : (
                    <span className="text-text-secondary">—</span>
                  )}
                </td>
                {showOwner && <td className="px-4 py-3 text-text-secondary">{t.ownerName}</td>}
                <td className="px-4 py-3">
                  <span className={`rounded-badge px-2.5 py-0.5 text-xs ${TASK_PRIORITY_BADGE[t.priority]}`}>
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showOwner ? 4 : 3} className="px-4 py-8 text-center text-text-secondary">
                  کاری برای امروز ثبت نشده.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
