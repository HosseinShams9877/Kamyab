import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listServices,
  listCategoryOptions,
  ServiceForm,
  ServiceRowActions,
} from "@/modules/services";
import { toPersianDigits } from "@/lib/digits";

// Services list + create (B-1). Server component: authorizes, reads through the
// services service, and renders. The create form is shown only to a user who may
// edit services; the API re-checks the same permission regardless (rule 3).

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "services.view")) redirect("/dashboard");

  const canEdit = can(user, "services.edit");
  const [services, categories] = await Promise.all([
    listServices(),
    listCategoryOptions(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">خدمات</h1>

      <div className="mb-8 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <table className="w-full text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">نام</th>
              <th className="px-4 py-3 font-medium">دسته‌بندی</th>
              <th className="px-4 py-3 font-medium">تمدیدشونده</th>
              <th className="px-4 py-3 font-medium">پرونده‌ها</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 text-text">{s.name}</td>
                <td className="px-4 py-3 text-text-secondary">{s.categoryTitle}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {s.renewable ? "بله" : "خیر"}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {toPersianDigits(String(s.caseCount))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-badge px-2.5 py-0.5 text-xs ${
                      s.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
                    }`}
                  >
                    {s.status ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td className="px-4 py-3 text-left">
                  <ServiceRowActions id={s.id} status={s.status} canEdit={canEdit} />
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  خدمتی ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-text">افزودن خدمت</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-text-secondary">
              ابتدا از بخش تنظیمات یک دسته‌بندی خدمات تعریف کنید.
            </p>
          ) : (
            <ServiceForm mode="create" categories={categories} />
          )}
        </section>
      )}
    </main>
  );
}
