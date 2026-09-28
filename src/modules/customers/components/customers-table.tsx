import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_SORT_LABELS,
} from "../lib/labels";
import type {
  CustomerListItem,
  CustomerListParams,
  ServiceFilterOption,
  EmployeeFilterOption,
} from "../customers.types";

type Props = {
  items: CustomerListItem[];
  params: CustomerListParams;
  cities: string[];
  services: ServiceFilterOption[];
  employees: EmployeeFilterOption[];
  page: number;
  pageCount: number;
  total: number;
  buildPageHref: (page: number) => string;
  showOwnerFilter?: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

export function CustomersTable({
  items,
  params,
  cities,
  services,
  employees,
  page,
  pageCount,
  total,
  buildPageHref,
  showOwnerFilter = true,
}: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <form
        method="get"
        action="."
        className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <input
            name="q"
            type="text"
            defaultValue={params.q ?? ""}
            placeholder="نام، شماره تماس، کد ملی یا شناسه ملی…"
            className={inputClass}
          />
        </div>
        <div>
          <select name="type" defaultValue={params.type ?? ""} className={inputClass}>
            <option value="">نوع مشتری</option>
            <option value="NATURAL">{CUSTOMER_TYPE_LABELS.NATURAL}</option>
            <option value="LEGAL">{CUSTOMER_TYPE_LABELS.LEGAL}</option>
          </select>
        </div>
        <div>
          <select name="city" defaultValue={params.city ?? ""} className={inputClass}>
            <option value="">شهر</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <select name="serviceId" defaultValue={params.serviceId ?? ""} className={inputClass}>
            <option value="">خدمت</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {showOwnerFilter && (
          <div>
            <select name="ownerId" defaultValue={params.ownerId ?? ""} className={inputClass}>
              <option value="">کارمند</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
            <option value="">وضعیت</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </div>
        <div>
          <select name="sort" defaultValue={params.sort ?? "newest"} className={inputClass}>
            <option value="newest">{CUSTOMER_SORT_LABELS.newest}</option>
            <option value="name">{CUSTOMER_SORT_LABELS.name}</option>
            <option value="cases">{CUSTOMER_SORT_LABELS.cases}</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-6 lg:justify-end">
          <button
            type="submit"
            className="min-h-[44px] rounded-control bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            اعمال فیلتر
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">نام مشتری</th>
              <th className="px-4 py-3 font-medium">شماره تماس</th>
              <th className="px-4 py-3 font-medium">شهر</th>
              <th className="px-4 py-3 font-medium">خدمات فعال</th>
              <th className="px-4 py-3 font-medium">آخرین پیگیری</th>
              <th className="px-4 py-3 font-medium">مسئول</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="text-text break-words font-medium">{c.displayName}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {c.type === "LEGAL" ? "شرکت / شخصیت حقوقی" : "شخص حقیقی"} —{" "}
                    <span dir="ltr">{c.code}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text" dir="ltr">
                  {toPersianDigits(c.mobile)}
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.city ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.activeServiceNames.length === 0 ? (
                    <span className="text-text-secondary">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.activeServiceNames.map((name, i) => (
                        <span
                          key={`${c.id}-svc-${i}`}
                          className="rounded-badge bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary" dir="ltr">
                  {c.lastFollowUpAt ? toPersianDigits(c.lastFollowUpAt) : "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.ownerName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-badge px-2.5 py-0.5 text-xs ${
                      c.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
                    }`}
                  >
                    {c.status ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${c.id}`}
                    className="inline-flex min-h-[36px] items-center rounded-control border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-page"
                  >
                    پرونده مشتری
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  مشتری‌ای یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-text-secondary">
        <span>
          {toPersianDigits(String(total))} مشتری · صفحهٔ{" "}
          {toPersianDigits(String(page))} از {toPersianDigits(String(pageCount))}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link
              href={buildPageHref(page - 1)}
              className="min-h-[44px] rounded-control border border-border px-3 py-2 text-text hover:bg-page sm:min-h-0 sm:py-1.5"
            >
              قبلی
            </Link>
          )}
          {page < pageCount && (
            <Link
              href={buildPageHref(page + 1)}
              className="min-h-[44px] rounded-control border border-border px-3 py-2 text-text hover:bg-page sm:min-h-0 sm:py-1.5"
            >
              بعدی
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}