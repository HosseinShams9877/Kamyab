import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  listCasesView,
  CASE_STATUS_LABELS,
  CASE_STATUS_BADGE,
  type CaseListParams,
  type CaseStatusFilter,
} from "@/modules/cases";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";

// Employee "my cases" list (C-15). The same listCasesView query as the manager
// /cases page — scopeByOwnership resolves an employee (cases.view_own) to their
// own cases, so no extra filter is needed here; only the guard, the filter-form
// action and the pagination links differ (they stay inside /employee/cases).
// Case detail is the shared /cases/[id], which guards by ownership.
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

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

export default async function EmployeeCasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (!can(user, "cases.view_all") && !can(user, "cases.view_own")) {
    redirect("/employee");
  }

  const sp = await searchParams;
  const statusRaw = one(sp.status);
  const params: CaseListParams = {
    q: one(sp.q),
    status: (STATUS_VALUES as string[]).includes(statusRaw)
      ? (statusRaw as CaseStatusFilter)
      : "",
    hasBalance: one(sp.hasBalance) === "1",
    stale: one(sp.stale) === "1",
    page: Number(one(sp.page)) || 1,
  };

  const result = await listCasesView(user, params);

  function pageHref(page: number): string {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.hasBalance) qs.set("hasBalance", "1");
    if (params.stale) qs.set("stale", "1");
    qs.set("page", String(page));
    return `/employee/cases?${qs.toString()}`;
  }

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">پرونده‌های من</h1>
      </div>
      {/* Filter bar — a GET form so all state lives in the URL. */}
      <form
        method="get"
        action="/employee/cases"
        className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-text">جستجو</label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={params.q}
            placeholder="شمارهٔ پرونده، نام مشتری، خدمت"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-text">وضعیت</label>
          <select id="status" name="status" defaultValue={params.status} className={inputClass}>
            <option value="">همه</option>
            <option value="active">فعال</option>
            <option value="NEW">{CASE_STATUS_LABELS.NEW}</option>
            <option value="IN_PROGRESS">{CASE_STATUS_LABELS.IN_PROGRESS}</option>
            <option value="COMPLETED">{CASE_STATUS_LABELS.COMPLETED}</option>
            <option value="CANCELLED">{CASE_STATUS_LABELS.CANCELLED}</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" name="hasBalance" value="1" defaultChecked={params.hasBalance} className="h-4 w-4" />
            دارای مانده
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" name="stale" value="1" defaultChecked={params.stale} className="h-4 w-4" />
            راکد
          </label>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="min-h-[44px] rounded-control bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            اعمال
          </button>
        </div>
      </form>
      <div className="mb-4 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">شمارهٔ پرونده</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">خدمت</th>
                <th className="px-4 py-3 font-medium">مسئول</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">مانده</th>
                <th className="px-4 py-3 font-medium">آخرین فعالیت</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text" dir="ltr">{toPersianDigits(c.number)}</td>
                  <td className="px-4 py-3 text-text break-words">{c.customerName}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.serviceName}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.ownerName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-badge px-2.5 py-0.5 text-xs ${CASE_STATUS_BADGE[c.status]}`}>
                      {CASE_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">
                    {c.balance === null ? "—" : formatToman(c.balance)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary" dir="ltr">
                    {toPersianDigits(c.lastActivity)}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link href={`/cases/${c.id}`} className="text-sm text-primary hover:underline">
                      مشاهده
                    </Link>
                  </td>
                </tr>
              ))}
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    پرونده‌ای یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
        <span>
          {toPersianDigits(String(result.total))} پرونده · صفحهٔ{" "}
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
