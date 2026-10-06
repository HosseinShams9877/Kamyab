import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  canManageCampaigns,
  canCreateCampaign,
  listCampaignsView,
  CampaignsTable,
} from "@/modules/campaigns";

// Employee view of campaigns. Read-only list plus an optional "new campaign"
// button when the employee has the campaigns.create permission (server-side
// checked; the API re-checks on POST).

export const dynamic = "force-dynamic";

export default async function EmployeeCampaignsPage() {
  const user = await requireUser();
  if (!canManageCampaigns(user)) redirect("/employee");

  const result = await listCampaignsView(user, {});
  const mayCreate = canCreateCampaign(user);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">کمپین‌ها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            فهرست کمپین‌های ارسال گروهی
          </p>
        </div>
        {mayCreate && (
          <Link
            href="/employee/campaigns/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            + کمپین جدید
          </Link>
        )}
      </div>
      <CampaignsTable items={result.items} basePath="/employee/campaigns" />
    </main>
  );
}