import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getRenewalsView,
  RenewalsTable,
  RENEWAL_TABS,
  RENEWAL_TAB_LABELS,
  type RenewalTab,
  type RenewalTableRow,
} from "@/modules/periods";

// Employee "my renewals" queue (C-15). The periods service has no per-user seam,
// so we read the tab view and post-filter to the periods on the employee's own
// cases (by ownerId). Per-row Abandon/Restore stay gated by the scoped
// permission × ownership check — an employee without renewals.register/restore
// simply sees no such control. Tab links stay inside /employee/renewals.
export const dynamic = "force-dynamic";

export default async function EmployeeRenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "renewals.view")) redirect("/employee");

  const { tab: tabParam } = await searchParams;
  const tab: RenewalTab = (RENEWAL_TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as RenewalTab)
    : "all";

  const view = await getRenewalsView(tab);
  const rows: RenewalTableRow[] = view
    .filter((r) => r.ownerId === user.id)
    .map((r) => ({
      ...r,
      canAbandon:
        can(user, "renewals.register") && can(user, "cases.edit", { ownerId: r.ownerId }),
      canRestore:
        can(user, "renewals.restore") && can(user, "cases.edit", { ownerId: r.ownerId }),
    }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">تمدیدهای من</h1>

      <nav className="mb-6 flex flex-wrap gap-2">
        {RENEWAL_TABS.map((k) => {
          const isActive = k === tab;
          return (
            <Link
              key={k}
              href={`/employee/renewals?tab=${k}`}
              className={`min-h-[44px] rounded-control px-4 text-sm leading-[44px] ${
                isActive
                  ? "bg-primary text-white"
                  : "border border-border text-text hover:bg-page"
              }`}
            >
              {RENEWAL_TAB_LABELS[k]}
            </Link>
          );
        })}
      </nav>

      <RenewalsTable rows={rows} />
    </main>
  );
}
