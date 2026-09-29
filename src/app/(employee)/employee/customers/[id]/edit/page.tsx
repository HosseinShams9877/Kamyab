import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCustomer, CustomerForm } from "@/modules/customers";

// Employee "edit customer" page (C-15): a copy of the manager /customers/[id]/edit
// page that lives under /employee so navigation stays inside the employee shell.
export default async function EmployeeEditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "customers.edit")) redirect("/employee/customers");

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link
          href={`/employee/customers/${id}`}
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به صفحهٔ مشتری
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ویرایش مشتری</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CustomerForm mode="edit" customer={customer} basePath="/employee/customers" />
      </section>
    </main>
  );
}