import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  canCreateCampaign,
  getCampaignFormData,
  CampaignForm,
} from "@/modules/campaigns";

// Employee-facing campaign creation page — only accessible when the employee
// has the campaigns.create permission (checked both here and in the API).

export const dynamic = "force-dynamic";

export default async function EmployeeNewCampaignPage() {
  const user = await requireUser();
  if (!canCreateCampaign(user)) redirect("/employee/campaigns");

  const data = await getCampaignFormData();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link
          href="/employee/campaigns"
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به کمپین‌ها
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">کمپین جدید</h1>
      <CampaignForm data={data} />
    </main>
  );
}