import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { CustomerForm } from "@/modules/customers";

// Employee "new customer" page (C-15): a copy of the manager /customers/new page
// that lives under /employee so navigation stays inside the employee shell.
export default async function EmployeeNewCustomerPage() {
  const user = await requireUser();
  if (!can(user, "customers.create")) redirect("/employee/customers");

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link
          href="/employee/customers"
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به فهرست مشتریان
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ثبت مشتری جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CustomerForm mode="create" basePath="/employee/customers" />
      </section>
    </main>
  );
}