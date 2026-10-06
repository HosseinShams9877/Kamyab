import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  canCreateCampaign,
  getCampaignFormData,
  CampaignForm,
} from "@/modules/campaigns";

// The new-campaign page. Loads the pick lists (templates + services) and hands
// them to the client form.

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!canCreateCampaign(user)) redirect("/campaigns");

  const data = await getCampaignFormData();

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/campaigns" className="text-sm text-primary hover:underline">
          ← بازگشت به کمپین‌ها
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">کمپین جدید</h1>
      <CampaignForm data={data} />
    </main>
  );
}