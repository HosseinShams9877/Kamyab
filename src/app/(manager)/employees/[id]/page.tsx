import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getEmployee,
  getPermissionsView,
  listDepartmentOptions,
  listSuccessorCandidates,
  EmployeeForm,
  SetPasswordForm,
  PermissionMatrix,
  DeactivatePanel,
  ReactivateButton,
  ROLE_LABELS,
} from "@/modules/employees";

// Manage a single employee (C-12): profile, password, permission matrix, and the
// status/deactivation flow — grouped into URL-driven tabs (`?tab=…`) so back/
// forward and refresh behave like the employee-shell twin. Each section is shown
// according to the viewer's permissions; the API enforces the same checks
// server-side.

type TabKey = "profile" | "permissions" | "security";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "پروفایل" },
  { key: "permissions", label: "دسترسی‌ها" },
  { key: "security", label: "امنیت" },
];

function readTab(raw: string | string[] | undefined): TabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "permissions" || v === "security" ? v : "profile";
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "employees.view")) redirect("/dashboard");

  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = readTab(tab);

  const employee = await getEmployee(id);
  if (!employee) notFound();

  const [departments, permissionsView, candidates] = await Promise.all([
    listDepartmentOptions(),
    getPermissionsView(id, employee.role),
    listSuccessorCandidates(id),
  ]);

  const mayEdit = can(user, "employees.edit");
  const mayChangePermissions = can(user, "employees.change_permissions");
  const isSelf = user.id === employee.id;

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-primary hover:underline">
          ← بازگشت به فهرست کارکنان
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text break-words">{employee.fullName}</h1>
        <span
          className={`rounded-badge px-2.5 py-0.5 text-xs ${
            employee.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
          }`}
        >
          {employee.status ? "فعال" : "غیرفعال"}
        </span>
        <span className="text-sm text-text-secondary">{ROLE_LABELS[employee.role]}</span>
      </div>

      {/* Tab bar — URL-driven, mirrors the /employee/employees/[id] twin. */}
      <div
        role="tablist"
        className="mb-6 flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={`/employees/${employee.id}?tab=${t.key}`}
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
            <h2 className="mb-4 text-base font-bold text-text">مشخصات</h2>
            {mayEdit ? (
              <EmployeeForm mode="edit" departments={departments} employee={employee} />
            ) : (
              <p className="text-sm text-text-secondary">
                شما اجازهٔ ویرایش این کارمند را ندارید.
              </p>
            )}
          </section>

          {mayEdit && (
            <section className="rounded-card border border-border bg-card p-6 shadow-card">
              <h2 className="mb-4 text-base font-bold text-text">وضعیت حساب</h2>
              {employee.status ? (
                <DeactivatePanel
                  employeeId={employee.id}
                  isSelf={isSelf}
                  candidates={candidates}
                />
              ) : (
                <ReactivateButton employeeId={employee.id} />
              )}
            </section>
          )}
        </div>
      )}

      {/* Permissions tab */}
      {activeTab === "permissions" && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-base font-bold text-text">دسترسی‌ها</h2>
          <PermissionMatrix
            employeeId={employee.id}
            role={permissionsView.role}
            defaults={permissionsView.defaults}
            effective={permissionsView.effective}
            canEdit={mayChangePermissions}
          />
        </section>
      )}

      {/* Security tab */}
      {activeTab === "security" && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-1 text-base font-bold text-text">رمز عبور</h2>
          <p className="mb-4 text-sm text-text-secondary">
            رمز فعلی قابل مشاهده نیست؛ فقط می‌توانید رمز جدید تعیین کنید.
          </p>
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