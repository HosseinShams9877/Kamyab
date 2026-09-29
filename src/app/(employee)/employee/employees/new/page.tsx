import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { listDepartmentOptions, EmployeeForm } from "@/modules/employees";

// Employee "new employee" page (C-15). Mirrors the manager /employees/new page.
export const dynamic = "force-dynamic";

export default async function EmployeeNewEmployeePage() {
  const user = await requireUser();
  if (!can(user, "employees.create")) redirect("/employee");

  const departments = await listDepartmentOptions();

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
      <h1 className="mb-6 text-2xl font-bold text-text">افزودن کارمند</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <EmployeeForm mode="create" departments={departments} />
      </section>
    </main>
  );
}