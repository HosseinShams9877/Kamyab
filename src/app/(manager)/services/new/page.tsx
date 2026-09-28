import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { listCategoryOptions, ServiceForm } from "@/modules/services";

// Standalone "new service" page (B-1). After creation the form redirects to
// /services/<id>.
export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "services.edit")) redirect("/services");

  const categories = await listCategoryOptions();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/services" className="text-sm text-primary hover:underline">
          ← بازگشت به خدمات
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">تعریف خدمت جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        {categories.length === 0 ? (
          <p className="text-sm text-text-secondary">
            ابتدا از بخش تنظیمات یک دسته‌بندی خدمات تعریف کنید.
          </p>
        ) : (
          <ServiceForm mode="create" categories={categories} />
        )}
      </section>
    </main>
  );
}