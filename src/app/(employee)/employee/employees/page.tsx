import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listEmployees,
  getEmployeeStats,
  ROLE_LABELS,
  EmployeeRowActions,
} from "@/modules/employees";
import { toPersianDigits } from "@/lib/digits";

// Employee "employees" list (C-15): read-only view of the team. An employee
// with employees.view can see everyone, but the "edit / permissions /
// deactivate" controls only show when the matching per-employee permission is
// held (usually only a manager does). The API re-checks each request.
export const dynamic = "force-dynamic";

export default async function EmployeeEmployeesPage() {
  const user = await requireUser();
  if (!can(user, "employees.view")) redirect("/employee");

  const mayCreate = can(user, "employees.create");
  const mayEdit = can(user, "employees.edit");
  const [employees, stats] = await Promise.all([
    listEmployees(),
    getEmployeeStats(),
  ]);

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "active", label: "کارمند فعال", value: stats.active, tone: "text-success" },
    { key: "inactive", label: "غیرفعال", value: stats.inactive, tone: "text-text-secondary" },
    { key: "roles", label: "نقش‌های کاربری", value: stats.roles, tone: "text-info" },
    {
      key: "permissionOverrides",
      label: "دسترسی‌های تعریف‌شده",
      value: stats.permissionOverrides,
      tone: "text-warning",
    },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">کارمندان و دسترسی‌ها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            کاربران عملیاتی سامانه و سطح دسترسی هرکدام
          </p>
        </div>
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
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">دپارتمان</th>
                <th className="px-4 py-3 font-medium">تلفن</th>
                <th className="px-4 py-3 font-medium">ایمیل</th>
                <th className="px-4 py-3 font-medium">پرونده فعال</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text break-words font-medium">{e.fullName}</td>
                  <td className="px-4 py-3 text-text-secondary">{ROLE_LABELS[e.role]}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.departmentTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-text" dir="ltr">
                    {toPersianDigits(e.mobile)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary" dir="ltr">
                    {e.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text">
                    {toPersianDigits(String(e.activeCases))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-badge px-2.5 py-0.5 text-xs ${
                        e.status
                          ? "bg-success-bg text-success"
                          : "bg-disabled-bg text-disabled"
                      }`}
                    >
                      {e.status ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeRowActions id={e.id} status={e.status} canEdit={mayEdit} basePath="/employee/employees" />
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    کارمندی ثبت نشده است.
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