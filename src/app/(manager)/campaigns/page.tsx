import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  canManageCampaigns,
  canCreateCampaign,
  listCampaignsView,
  CampaignsTable,
} from "@/modules/campaigns";

// Campaigns list (CRM-style). Shows a filterable list of every campaign with
// its channel, status, and recipient count.

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!canManageCampaigns(user)) redirect("/dashboard");

  const sp = await searchParams;
  const result = await listCampaignsView(user, {
    q: sp.q,
    status: (sp.status as never) ?? "",
    page: Number(sp.page ?? "1") || 1,
  });

  const mayCreate = canCreateCampaign(user);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">کمپین‌ها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            ارسال گروهی پیامک یا اعلان داخلی به مخاطبان انتخابی
          </p>
        </div>
        {mayCreate && (
          <Link
            href="/campaigns/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            + کمپین جدید
          </Link>
        )}
      </div>

      <CampaignsTable items={result.items} />
    </main>
  );
}