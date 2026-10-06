import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listCustomers,
  listCityOptions,
  listServiceOptions,
  listEmployeeOptions,
  getCustomerStats,
  CustomersTable,
  type CustomerListParams,
  type CustomerSort,
} from "@/modules/customers";
import { toPersianDigits } from "@/lib/digits";

// Customer list (C-3): server-side search, filters, sort, and pagination. The
// filter bar, table, and pagination all live inside one card component
// (CustomersTable); this page only fetches data and lays out the header + the
// four headline stat cards.

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "customers.view")) redirect("/dashboard");

  const sp = await searchParams;
  const params: CustomerListParams = {
    q: one(sp.q),
    type:
      one(sp.type) === "NATURAL" || one(sp.type) === "LEGAL"
        ? (one(sp.type) as "NATURAL" | "LEGAL")
        : "",
    status:
      one(sp.status) === "active" || one(sp.status) === "inactive"
        ? (one(sp.status) as "active" | "inactive")
        : "",
    city: one(sp.city),
    serviceId: one(sp.serviceId),
    ownerId: one(sp.ownerId),
    sort: (["newest", "name", "cases"].includes(one(sp.sort))
      ? one(sp.sort)
      : "newest") as CustomerSort,
    page: Number(one(sp.page)) || 1,
  };

  const [result, cities, services, employees, stats] = await Promise.all([
    listCustomers(params),
    listCityOptions(),
    listServiceOptions(),
    listEmployeeOptions(),
    getCustomerStats(),
  ]);
  const mayCreate = can(user, "customers.create");

  function pageHref(page: number): string {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.type) qs.set("type", params.type);
    if (params.status) qs.set("status", params.status);
    if (params.city) qs.set("city", params.city);
    if (params.serviceId) qs.set("serviceId", params.serviceId);
    if (params.ownerId) qs.set("ownerId", params.ownerId);
    if (params.sort) qs.set("sort", params.sort);
    qs.set("page", String(page));
    return `/customers?${qs.toString()}`;
  }

  const statCards: { key: string; label: string; value: number; tone: string }[] = [
    { key: "total", label: "کل مشتریان", value: stats.total, tone: "text-text" },
    { key: "active", label: "مشتریان فعال", value: stats.active, tone: "text-success" },
    {
      key: "nearRenewal",
      label: "تمدید نزدیک",
      value: stats.nearRenewal,
      tone: "text-warning",
    },
    {
      key: "inactive",
      label: "مشتریان غیرفعال",
      value: stats.inactive,
      tone: "text-text-secondary",
    },
  ];

  return (
    <main className="mx-auto w-full px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">مشتریان</h1>
          <p className="mt-1 text-sm text-text-secondary">
            بانک مرکزی تمام مشتریان شرکت
          </p>
        </div>
        {mayCreate && (
          <Link
            href="/customers/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            + ثبت مشتری جدید
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
      <CustomersTable
        items={result.items}
        params={params}
        cities={cities}
        services={services}
        employees={employees}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        buildPageHref={pageHref}
        basePath="/customers"
      />
    </main>
  );
}