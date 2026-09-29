import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getEmployee,
  listDepartmentOptions,
  listSuccessorCandidates,
  getPermissionsView,
  getWorkload,
  EmployeeForm,
  SetPasswordForm,
  PermissionMatrix,
  DeactivatePanel,
  ReactivateButton,
} from "@/modules/employees";

// Employee detail page in the employee route group (C-15). Mirrors the manager
// /employees/[id] page exactly — same tabs, same controls — but everything is
// permission-gated server-side. `?tab=permissions` opens the matrix directly.
export const dynamic = "force-dynamic";

export default async function EmployeeEmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "employees.view")) redirect("/employee");

  const { id } = await params;
  const { tab } = await searchParams;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const [departments, permissions, candidates, workload] = await Promise.all([
    listDepartmentOptions(),
    getPermissionsView(id, employee.role),
    listSuccessorCandidates(id),
    getWorkload(id),
  ]);

  const mayEdit = can(user, "employees.edit");
  const mayChangePermissions = can(user, "employees.change_permissions");
  const isSelf = user.id === employee.id;

  const activeTab =
    tab === "permissions" ? "permissions" : tab === "security" ? "security" : "profile";

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link
          href="/employee/employees"
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به کارمندان
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{employee.fullName}</h1>
          <p className="mt-1 text-sm text-text-secondary" dir="ltr">
            {employee.mobile}
          </p>
        </div>
        <span
          className={`rounded-badge px-3 py-1 text-xs font-medium ${
            employee.status
              ? "bg-success-bg text-success"
              : "bg-disabled-bg text-disabled"
          }`}
        >
          {employee.status ? "فعال" : "غیرفعال"}
        </span>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="mb-6 flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {[
          { key: "profile", label: "پروفایل" },
          { key: "permissions", label: "دسترسی‌ها" },
          { key: "security", label: "امنیت" },
        ].map((t) => {
          const isActive = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={`/employee/employees/${employee.id}?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-text">اطلاعات کارمند</h2>
            <EmployeeForm mode="edit" departments={departments} employee={employee} />
          </section>

          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-text">وضعیت حساب</h2>
            {!employee.status ? (
              mayEdit ? (
                <ReactivateButton employeeId={employee.id} />
              ) : (
                <p className="text-sm text-text-secondary">
                  این کارمند غیرفعال است. برای فعال‌سازی دسترسی ندارید.
                </p>
              )
            ) : mayEdit ? (
              <DeactivatePanel
                employeeId={employee.id}
                isSelf={isSelf}
                candidates={candidates}
              />
            ) : (
              <p className="text-sm text-text-secondary">
                برای غیرفعال‌سازی دسترسی ندارید.
              </p>
            )}
            <p className="mt-3 text-xs text-text-secondary">
              پرونده‌های فعال: {workload.activeCases} · کارهای باز: {workload.openTasks}
            </p>
          </section>
        </div>
      )}

      {/* Permissions tab */}
      {activeTab === "permissions" && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-base font-bold text-text">دسترسی‌ها</h2>
          <PermissionMatrix
            employeeId={employee.id}
            role={employee.role}
            defaults={permissions.defaults}
            effective={permissions.effective}
            canEdit={mayChangePermissions}
          />
        </section>
      )}

      {/* Security tab */}
      {activeTab === "security" && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-base font-bold text-text">تغییر رمز عبور</h2>
          {mayEdit ? (
            <SetPasswordForm employeeId={employee.id} />
          ) : (
            <p className="text-sm text-text-secondary">
              برای تغییر رمز عبور دسترسی ندارید.
            </p>
          )}
        </section>
      )}
    </main>
  );
}