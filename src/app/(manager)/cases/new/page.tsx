import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCaseFormData, CaseForm } from "@/modules/cases";

// Register a new case (C-4). Server component: authorize, load the pick lists
// (with an optional prefilled customer from ?customerId), then render the client
// form. The API re-checks the same permission regardless (rule 3).
export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "cases.create")) redirect("/dashboard");

  const { customerId } = await searchParams;
  const data = await getCaseFormData(customerId ?? null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          ← بازگشت به داشبورد
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ثبت پروندهٔ جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CaseForm data={data} />
      </section>
    </main>
  );
}
