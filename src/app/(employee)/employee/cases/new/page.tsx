import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCaseFormData, CaseForm } from "@/modules/cases";

// Employee "new case" page (C-15): a copy of the manager /cases/new page that
// lives under /employee so navigation stays inside the employee shell.
export default async function EmployeeNewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "cases.create")) redirect("/employee");

  const { customerId } = await searchParams;
  const data = await getCaseFormData(customerId ?? null);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link
          href="/employee/cases"
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به پرونده‌ها
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ثبت پروندهٔ جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CaseForm data={data} basePath="/employee/cases" />
      </section>
    </main>
  );
}