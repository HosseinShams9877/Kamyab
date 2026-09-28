import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { listDepartmentOptions, EmployeeForm } from "@/modules/employees";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "employees.create")) redirect("/employees");

  const departments = await listDepartmentOptions();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-primary hover:underline">
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