import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { CustomerForm } from "@/modules/customers";

// Register a new customer (C-3). Server component: authorize, then render the
// (client) branching form. The API re-checks the same permission regardless.
export default async function NewCustomerPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "customers.create")) redirect("/customers");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-primary hover:underline">
          ← بازگشت به فهرست مشتریان
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ثبت مشتری جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CustomerForm mode="create" />
      </section>
    </main>
  );
}
