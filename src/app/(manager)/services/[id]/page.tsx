import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getService,
  listCategoryOptions,
  listReminderRules,
  ServiceForm,
  ReminderRulesEditor,
} from "@/modules/services";
import {
  getServicePaths,
  listDurations,
  PathEditor,
  DurationsEditor,
} from "@/modules/paths";

// Service detail (B-1..B-4). Server component: authorizes, reads the service and
// its full definition through the two modules, and renders the editors. The
// renewal path, durations, and reminder rules appear only for a renewable
// service (B-2/B-3/B-4); the APIs re-check every rule regardless.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ServiceDetailPage({ params }: Props) {
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
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">{service.name}</h1>
        <Link href="/services" className="text-sm text-primary hover:underline">
          ← بازگشت به خدمات
        </Link>
      </div>

      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-text">مشخصات خدمت</h2>
        <ServiceForm mode="edit" categories={categories} service={service} />
      </section>

      <PathEditor
        serviceId={id}
        pathType="INITIAL"
        stages={paths.initial}
        canEdit={canEdit}
      />

      {service.renewable && (
        <>
          <PathEditor
            serviceId={id}
            pathType="RENEWAL"
            stages={paths.renewal}
            canEdit={canEdit}
          />
          <DurationsEditor
            serviceId={id}
            durations={durations}
            canEdit={canEdit}
          />
          <ReminderRulesEditor
            serviceId={id}
            rules={reminderRules}
            canEdit={canEdit}
          />
        </>
      )}
    </main>
  );
}
