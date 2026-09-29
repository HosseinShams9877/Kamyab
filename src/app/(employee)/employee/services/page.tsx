import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listServices,
  getServiceStats,
  ServiceRowActions,
} from "@/modules/services";
import { toPersianDigits } from "@/lib/digits";

// Employee services list (C-15): the manager /services page, gated by
// services.view. The create button only appears when the employee has
// services.edit (a rare grant); the API re-checks either way.
export const dynamic = "force-dynamic";

export default async function EmployeeServicesPage() {
  const user = await requireUser();
  if (!can(user, "services.view")) redirect("/employee");

  const canEdit = can(user, "services.edit");
  const [services, stats] = await Promise.all([
    listServices(),
    getServiceStats(),
  ]);

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "total", label: "کل خدمات", value: stats.total, tone: "text-text" },
    { key: "active", label: "خدمات فعال", value: stats.active, tone: "text-success" },
    { key: "renewable", label: "قابل تمدید", value: stats.renewable, tone: "text-info" },
    {
      key: "reminderRules",
      label: "قواعد یادآوری",
      value: stats.reminderRules,
      tone: "text-warning",
    },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">خدمات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            موسسه اصلی، خدماتش را تمدید می‌کند؛ مدت اعتبار و قواعد یادآوری هر خدمت اینجا تعریف می‌شوند.
          </p>
        </div>
        {canEdit && (
          <Link
            href="/services/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            + تعریف خدمت جدید
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.key} className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-text-secondary">{s.label}</div>
            <div className={`mt-2 text-2xl font-bold ${s.tone}`}>
              {toPersianDigits(String(s.value))}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">دسته‌بندی</th>
                <th className="px-4 py-3 font-medium">تمدیدشونده</th>
                <th className="px-4 py-3 font-medium">پرونده‌ها</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text break-words font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.categoryTitle}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {s.renewable ? "بله" : "خیر"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {toPersianDigits(String(s.caseCount))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-badge px-2.5 py-0.5 text-xs ${
                        s.status
                          ? "bg-success-bg text-success"
                          : "bg-disabled-bg text-disabled"
                      }`}
                    >
                      {s.status ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ServiceRowActions id={s.id} status={s.status} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    خدمتی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}