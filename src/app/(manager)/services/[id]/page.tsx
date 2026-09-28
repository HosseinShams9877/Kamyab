import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getService,
  listCategoryOptions,
  listReminderRules,
  ServiceForm,
} from "@/modules/services";
import { getServicePaths, listDurations } from "@/modules/paths";

// Service detail (B-1/B-2/B-3/B-4). Server component: loads the service + all
// related data, then hands them to the client ServiceForm, which reveals the
// path/duration/reminder editors live when the renewable toggle is on.
export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "services.view")) redirect("/dashboard");

  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  const canEdit = can(user, "services.edit");
  const [categories, paths, durations, reminderRules] = await Promise.all([
    listCategoryOptions(),
    getServicePaths(id),
    service.renewable ? listDurations(id) : Promise.resolve([]),
    service.renewable ? listReminderRules(id) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/services" className="text-sm text-primary hover:underline">
          ← بازگشت به خدمات
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{service.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {service.renewable
            ? "این خدمت تمدیدشونده است؛ مدت اعتبار، مسیر تمدید و قواعد یادآوری دارد."
            : "این خدمت تمدیدشونده نیست؛ فقط مسیر ثبت اولیه دارد."}
        </p>
      </div>

      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-base font-bold text-text">اطلاعات خدمت</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-text-secondary">
            ابتدا از بخش تنظیمات یک دسته‌بندی خدمات تعریف کنید.
          </p>
        ) : (
          <ServiceForm
            mode="edit"
            categories={categories}
            service={service}
            initialStages={paths.initial}
            renewalStages={paths.renewal}
            durations={durations}
            reminderRules={reminderRules}
            canEdit={canEdit}
          />
        )}
      </section>
    </main>
  );
}