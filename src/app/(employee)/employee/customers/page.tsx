import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listCustomers,
  listCityOptions,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_SORT_LABELS,
  type CustomerListParams,
  type CustomerSort,
} from "@/modules/customers";
import { toPersianDigits } from "@/lib/digits";

// Employee customers list (C-15): the manager /customers page scoped to the
// customers related to the employee's own cases (listCustomers `ownerId`).
// Detail opens the shared /customers/[id] (customers.view is a global permission).
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

export default async function EmployeeCustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (!can(user, "customers.view")) redirect("/employee");

  const sp = await searchParams;
  const params: CustomerListParams = {
    q: one(sp.q),
    type: one(sp.type) === "NATURAL" || one(sp.type) === "LEGAL" ? (one(sp.type) as "NATURAL" | "LEGAL") : "",
    status: one(sp.status) === "active" || one(sp.status) === "inactive" ? (one(sp.status) as "active" | "inactive") : "",
    city: one(sp.city),
    sort: (["newest", "name", "cases"].includes(one(sp.sort)) ? one(sp.sort) : "newest") as CustomerSort,
    ownerId: user.id,
    page: Number(one(sp.page)) || 1,
  };

  const [result, cities] = await Promise.all([
    listCustomers(params),
    listCityOptions(),
  ]);
  const mayCreate = can(user, "customers.create");

  function pageHref(page: number): string {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.type) qs.set("type", params.type);
    if (params.status) qs.set("status", params.status);
    if (params.city) qs.set("city", params.city);
    if (params.sort) qs.set("sort", params.sort);
    qs.set("page", String(page));
    return `/employee/customers?${qs.toString()}`;
  }

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">مشتریان من</h1>
        {mayCreate && (
          <Link
            href="/customers/new"
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            ثبت مشتری جدید
          </Link>
        )}
      </div>
      {/* Filter bar — a GET form so all state lives in the URL. */}
      <form
        method="get"
        action="/employee/customers"
        className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-text">جستجو</label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={params.q}
            placeholder="نام، موبایل، کد ملی، شناسه ملی، کد مشتری"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-text">نوع</label>
          <select id="type" name="type" defaultValue={params.type} className={inputClass}>
            <option value="">همه</option>
            <option value="NATURAL">{CUSTOMER_TYPE_LABELS.NATURAL}</option>
            <option value="LEGAL">{CUSTOMER_TYPE_LABELS.LEGAL}</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-text">وضعیت</label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="">همه</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </div>
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-text">شهر</label>
          <select id="city" name="city" defaultValue={params.city} className={inputClass}>
            <option value="">همه</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="mb-1.5 block text-sm font-medium text-text">مرتب‌سازی</label>
          <select id="sort" name="sort" defaultValue={params.sort} className={inputClass}>
            <option value="newest">{CUSTOMER_SORT_LABELS.newest}</option>
            <option value="name">{CUSTOMER_SORT_LABELS.name}</option>
            <option value="cases">{CUSTOMER_SORT_LABELS.cases}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            اعمال
          </button>
        </div>
      </form>
      <div className="mb-4 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">کد</th>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">نوع</th>
                <th className="px-4 py-3 font-medium">موبایل</th>
                <th className="px-4 py-3 font-medium">شهر</th>
                <th className="px-4 py-3 font-medium">پرونده‌های فعال</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text-secondary" dir="ltr">{c.code}</td>
                  <td className="px-4 py-3 text-text break-words">{c.displayName}</td>
                  <td className="px-4 py-3 text-text-secondary">{CUSTOMER_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-3 text-text" dir="ltr">{toPersianDigits(c.mobile)}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.city ?? "—"}</td>
                  <td className="px-4 py-3 text-text">{toPersianDigits(String(c.activeCases))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-badge px-2.5 py-0.5 text-xs ${
                        c.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
                      }`}
                    >
                      {c.status ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link href={`/customers/${c.id}`} className="text-sm text-primary hover:underline">
                      مشاهده
                    </Link>
                  </td>
                </tr>
              ))}
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    مشتری‌ای یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
        <span>
          {toPersianDigits(String(result.total))} مشتری · صفحهٔ{" "}
          {toPersianDigits(String(result.page))} از {toPersianDigits(String(result.pageCount))}
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 && (
            <Link
              href={pageHref(result.page - 1)}
              className="min-h-[44px] rounded-control border border-border px-3 py-2 text-text hover:bg-page sm:min-h-0 sm:py-1.5"
            >
              قبلی
            </Link>
          )}
          {result.page < result.pageCount && (
            <Link
              href={pageHref(result.page + 1)}
              className="min-h-[44px] rounded-control border border-border px-3 py-2 text-text hover:bg-page sm:min-h-0 sm:py-1.5"
            >
              بعدی
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
