import Link from "next/link";
import { toPersianDigits } from "@/lib/digits";
import { CASE_STATUS_LABELS, CASE_STATUS_BADGE } from "../lib/labels";
import type {
  CaseListItem,
  CaseListParams,
  ServiceFilterOption,
  OwnerFilterOption,
} from "../cases.types";

// The cases list card (C-2 / C-15): ONE rounded card holding the filter bar,
// the table, and the pagination. Server-rendered; the filter bar is a GET form
// so every query lives in the URL.

type Props = {
  items: CaseListItem[];
  params: CaseListParams;
  services: ServiceFilterOption[];
  owners: OwnerFilterOption[];
  page: number;
  pageCount: number;
  total: number;
  buildPageHref: (page: number) => string;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

const STATUS_VALUES = [
  { value: "", label: "همه" },
  { value: "active", label: "فعال" },
  { value: "NEW", label: CASE_STATUS_LABELS.NEW },
  { value: "IN_PROGRESS", label: CASE_STATUS_LABELS.IN_PROGRESS },
  { value: "COMPLETED", label: CASE_STATUS_LABELS.COMPLETED },
  { value: "CANCELLED", label: CASE_STATUS_LABELS.CANCELLED },
];

export function CasesTable({
  items,
  params,
  services,
  owners,
  page,
  pageCount,
  total,
  buildPageHref,
}: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      {/* Filter bar */}
      <form
        method="get"
        action="/cases"
        className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="sm:col-span-2">
          <input
            name="q"
            type="text"
            defaultValue={params.q ?? ""}
            placeholder="شمارهٔ پرونده، نام مشتری یا خدمت…"
            className={inputClass}
          />
        </div>
        <div>
          <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
            {STATUS_VALUES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            name="serviceId"
            defaultValue={params.serviceId ?? ""}
            className={inputClass}
          >
            <option value="">خدمت</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            name="ownerId"
            defaultValue={params.ownerId ?? ""}
            className={inputClass}
          >
            <option value="">مسئول</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5 lg:justify-end">
          <button
            type="submit"
            className="min-h-[44px] rounded-control bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            اعمال فیلتر
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-right text-sm">
          <thead className="bg-page text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">شماره پرونده</th>
              <th className="px-4 py-3 font-medium">مشتری</th>
              <th className="px-4 py-3 font-medium">خدمت</th>
              <th className="px-4 py-3 font-medium">مسئول</th>
              <th className="px-4 py-3 font-medium">مرحله فعلی</th>
              <th className="px-4 py-3 font-medium">آخرین به‌روزرسانی</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 text-text" dir="ltr">
                  {toPersianDigits(c.number)}
                </td>
                <td className="px-4 py-3 text-text break-words">{c.customerName}</td>
                <td className="px-4 py-3 text-text-secondary">{c.serviceName}</td>
                <td className="px-4 py-3 text-text-secondary">{c.ownerName}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {c.currentStageTitle ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary" dir="ltr">
                  {toPersianDigits(c.lastActivity)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-badge px-2.5 py-0.5 text-xs ${CASE_STATUS_BADGE[c.status]}`}
                  >
                    {CASE_STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/cases/${c.id}`}
                    className="inline-flex min-h-[36px] items-center rounded-control border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-page"
                  >
                    جزئیات
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  پرونده‌ای یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-text-secondary">
        <span>
          {toPersianDigits(String(total))} پرونده · صفحهٔ{" "}
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