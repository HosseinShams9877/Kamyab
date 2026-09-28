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
// status/deactivation flow. Each section is shown according to the viewer's
// permissions; the API enforces the same checks server-side.
export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "employees.view")) redirect("/dashboard");

  const { id } = await params;
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

      <div className="space-y-6">
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-text">مشخصات</h2>
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
            <h2 className="mb-1 text-lg font-bold text-text">رمز عبور</h2>
            <p className="mb-4 text-sm text-text-secondary">
              رمز فعلی قابل مشاهده نیست؛ فقط می‌توانید رمز جدید تعیین کنید.
            </p>
            <SetPasswordForm employeeId={employee.id} />
          </section>
        )}

        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-text">دسترسی‌ها</h2>
          <PermissionMatrix
            employeeId={employee.id}
            role={permissionsView.role}
            defaults={permissionsView.defaults}
            effective={permissionsView.effective}
            canEdit={mayChangePermissions}
          />
        </section>

        {mayEdit && (
          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-text">وضعیت</h2>
            {employee.status ? (
              <DeactivatePanel employeeId={employee.id} isSelf={isSelf} candidates={candidates} />
            ) : (
              <ReactivateButton employeeId={employee.id} />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
