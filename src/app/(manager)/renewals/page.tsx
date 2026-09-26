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

// The renewals work-queue page (C-10): six live tabs over every ACTIVE/ABANDONED
// period, a row click opens the case, and (permitting) an Abandon / Restore control
// per row. Server component — it authorizes (rule 3), reads the tab view through
// the periods service, and augments each row with the two per-row capability flags
// (scoped permission × case ownership) the client table needs. Dynamic: the active
// tab is a query param and days-remaining depends on "today" (rule 2).
export const dynamic = "force-dynamic";

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "renewals.view")) redirect("/dashboard");

  const { tab: tabParam } = await searchParams;
  const tab: RenewalTab = (RENEWAL_TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as RenewalTab)
    : "all";

  const view = await getRenewalsView(tab);
  const rows: RenewalTableRow[] = view.map((r) => ({
    ...r,
    canAbandon: can(user, "renewals.register") && can(user, "cases.edit", { ownerId: r.ownerId }),
    canRestore: can(user, "renewals.restore") && can(user, "cases.edit", { ownerId: r.ownerId }),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">تمدیدها</h1>

      <nav className="mb-6 flex flex-wrap gap-2">
        {RENEWAL_TABS.map((k) => {
          const isActive = k === tab;
          return (
            <Link
              key={k}
              href={`/renewals?tab=${k}`}
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
