import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCustomer, CustomerForm } from "@/modules/customers";

// Edit a customer (C-3). Prefills the same branching form the create page uses.
export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "customers.edit")) {
    redirect(user.role === "EMPLOYEE" ? "/employee/customers" : "/customers");
  }

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link href={`/customers/${id}`} className="text-sm text-primary hover:underline">
          ← بازگشت به صفحهٔ مشتری
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ویرایش مشتری</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <CustomerForm mode="edit" customer={customer} />
      </section>
    </main>
  );
}
