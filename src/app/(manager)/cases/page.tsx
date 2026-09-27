import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listCasesView,
  getCaseStats,
  listServiceFilterOptions,
  listOwnerFilterOptions,
  CasesTable,
  type CaseListParams,
  type CaseStatusFilter,
} from "@/modules/cases";
import { toPersianDigits } from "@/lib/digits";

// Cases list (C-2 / C-15): server-side search, filters, and 10-row pagination.
// The stat cards + filter bar + table + pagination all live inside the
// CasesTable component; this page only fetches data and lays out the header +
// the four headline stat cards.

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const STATUS_VALUES: CaseStatusFilter[] = [
  "",
  "active",
  "NEW",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "cases.view_all") && !can(user, "cases.view_own")) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const statusRaw = one(sp.status);
  const params: CaseListParams = {
    q: one(sp.q),
    status: (STATUS_VALUES as string[]).includes(statusRaw)
      ? (statusRaw as CaseStatusFilter)
      : "",
    serviceId: one(sp.serviceId),
    ownerId: one(sp.ownerId),
    hasBalance: one(sp.hasBalance) === "1",
    stale: one(sp.stale) === "1",
    page: Number(one(sp.page)) || 1,
  };

  const [result, stats, services, owners] = await Promise.all([
    listCasesView(user, params),
    getCaseStats(user),
    listServiceFilterOptions(),
    listOwnerFilterOptions(),
  ]);
  const mayCreate = can(user, "cases.create");

  function pageHref(page: number): string {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.serviceId) qs.set("serviceId", params.serviceId);
    if (params.ownerId) qs.set("ownerId", params.ownerId);
    if (params.hasBalance) qs.set("hasBalance", "1");
    if (params.stale) qs.set("stale", "1");
    qs.set("page", String(page));
    return `/cases?${qs.toString()}`;
  }

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "total", label: "همه پرونده‌ها", value: stats.total, tone: "text-text" },
    { key: "active", label: "فعال", value: stats.active, tone: "text-success" },
    {
      key: "waitingAction",
      label: "در انتظار اقدام",
      value: stats.waitingAction,
      tone: "text-warning",
    },
    {
      key: "completedThisMonth",
      label: "تکمیل‌شده این ماه",
      value: stats.completedThisMonth,
      tone: "text-text-secondary",
    },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">پرونده‌ها</h1>
          <p className="mt-1 text-sm text-text-secondary">
            پرونده خدماتی: مشتری + خدمت + مسئول + چرخه تمدید
          </p>
        </div>
        {mayCreate && (
          <Link
            href="/cases/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            + ثبت پرونده جدید
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="rounded-card border border-border bg-card p-5 shadow-card"
          >
            <div className="text-sm text-text-secondary">{s.label}</div>
            <div className={`mt-2 text-2xl font-bold ${s.tone}`}>
              {toPersianDigits(String(s.value))}
            </div>
          </div>
        ))}
      </div>

      {/* One card: filter + table + pagination */}
      <CasesTable
        items={result.items}
        params={params}
        services={services}
        owners={owners}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        buildPageHref={pageHref}
      />
    </main>
  );
}