import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getRenewalsView,
  getRenewalStats,
  RenewalsTable,
  RENEWAL_TABS,
  RENEWAL_TAB_LABELS,
  type RenewalTab,
  type RenewalTableRow,
  type RenewalListParams,
} from "@/modules/periods";
import { listActiveServiceOptions } from "@/modules/services";
import { listCaseOwnerOptions } from "@/modules/employees";
import { toPersianDigits } from "@/lib/digits";

const FOLLOW_UP_VALUES = [
  "NOT_FOLLOWED_UP",
  "CONTACTED",
  "AWAITING_CUSTOMER",
  "AGREES_TO_RENEW",
  "NOT_INTERESTED",
] as const;

export const dynamic = "force-dynamic";

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    serviceId?: string;
    ownerId?: string;
    followUpStatus?: string;
  }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "renewals.view")) redirect("/dashboard");

  const sp = await searchParams;
  const tab: RenewalTab = (RENEWAL_TABS as string[]).includes(sp.tab ?? "")
    ? (sp.tab as RenewalTab)
    : "all";

  const followUpRaw = sp.followUpStatus ?? "";
  const params: RenewalListParams = {
    q: sp.q ?? "",
    serviceId: sp.serviceId ?? "",
    ownerId: sp.ownerId ?? "",
    followUpStatus: (FOLLOW_UP_VALUES as readonly string[]).includes(followUpRaw)
      ? (followUpRaw as (typeof FOLLOW_UP_VALUES)[number])
      : "",
  };

  const [view, stats, services, ownerRows] = await Promise.all([
    getRenewalsView(tab, params),
    getRenewalStats(),
    listActiveServiceOptions(),
    listCaseOwnerOptions(),
  ]);

  const rows: RenewalTableRow[] = view.map((r) => ({
    ...r,
    canAbandon:
      can(user, "renewals.register") && can(user, "cases.edit", { ownerId: r.ownerId }),
    canRestore:
      can(user, "renewals.restore") && can(user, "cases.edit", { ownerId: r.ownerId }),
  }));

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "expired", label: "منقضی‌شده", value: stats.expired, tone: "text-error" },
    { key: "within7", label: "تا ۷ روز آینده", value: stats.within7, tone: "text-warning" },
    { key: "within30", label: "تا ۳۰ روز آینده", value: stats.within30, tone: "text-info" },
    { key: "beyond30", label: "بیش از ۳۰ روز", value: stats.beyond30, tone: "text-text" },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">تمدیدها</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تمدیدها به‌صورت خودکار از قواعد خدمات ساخته می‌شوند؛ هیچ یادآوری دستی لازم نیست.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.key} className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="text-sm text-text-secondary">{s.label}</div>
            <div className={`mt-2 text-2xl font-bold ${s.tone}`}>
              {toPersianDigits(String(s.value))}
            </div>
          </div>
        ))}
      </div>

      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {RENEWAL_TABS.map((k) => {
          const isActive = k === tab;
          return (
            <Link
              key={k}
              href={`/renewals?tab=${k}`}
              role="tab"
              aria-selected={isActive}
              className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {RENEWAL_TAB_LABELS[k]}
            </Link>
          );
        })}
      </div>

      <RenewalsTable
        rows={rows}
        params={params}
        owners={ownerRows}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        basePath="/renewals"
        currentTab={tab}
      />
    </main>
  );
}