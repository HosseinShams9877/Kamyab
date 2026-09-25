import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { listDepartmentOptions, listEmployees, EmployeeForm, ROLE_LABELS } from "@/modules/employees";

// Employees list + create (C-12). Server component: it authorizes, reads through
// the employees service, and renders. The create form is shown only to a user
// who may create employees; the API re-checks the same permission regardless.
export default async function EmployeesPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "employees.view")) redirect("/dashboard");

  const [employees, departments] = await Promise.all([
    listEmployees(),
    listDepartmentOptions(),
  ]);
  const mayCreate = can(user, "employees.create");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">کارکنان</h1>

      <div className="mb-8 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">نام</th>
              <th className="px-4 py-3 font-medium">موبایل</th>
              <th className="px-4 py-3 font-medium">دپارتمان</th>
              <th className="px-4 py-3 font-medium">نقش</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 text-text">{e.fullName}</td>
                <td className="px-4 py-3 text-text" dir="ltr">{e.mobile}</td>
                <td className="px-4 py-3 text-text-secondary">{e.departmentTitle ?? "—"}</td>
                <td className="px-4 py-3 text-text">{ROLE_LABELS[e.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-badge px-2.5 py-0.5 text-xs ${
                      e.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
                    }`}
                  >
                    {e.status ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td className="px-4 py-3 text-left">
                  <Link href={`/employees/${e.id}`} className="text-sm text-primary hover:underline">
                    مدیریت
                  </Link>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  کارمندی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {mayCreate && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-text">افزودن کارمند</h2>
          <EmployeeForm mode="create" departments={departments} />
        </section>
      )}
    </main>
  );
}
