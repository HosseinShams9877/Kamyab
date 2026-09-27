import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getCustomer,
  getCustomerPageData,
  customerDisplayName,
  CustomerActions,
  CUSTOMER_TYPE_LABELS,
  CASE_STATUS_LABELS,
} from "@/modules/customers";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
import { toJalali, formatJalali } from "@/lib/jalali";

// A single customer's page (C-3): top card, their cases with computed progress
// and balance, the grand-total balance, the follow-up timeline, and a pre-filled
// "register new case" button.
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  // `customers.view` is a global (non-owner-scoped) permission, so an employee
  // who holds it may open any customer — this shared /customers/[id] route serves
  // both roles. The cases listed here still link into /cases/[id], which gates by
  // ownership, and every mutation API re-checks (rule 3).
  if (!can(user, "customers.view")) {
    redirect(user.role === "EMPLOYEE" ? "/employee" : "/dashboard");
  }

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const page = await getCustomerPageData(id);
  const name = customerDisplayName(customer);
  const mayEdit = can(user, "customers.edit");
  const mayManage = can(user, "customers.deactivate");
  const mayCreateCase = can(user, "cases.create");

  const balanceText = (b: number | null) => (b === null ? "—" : formatToman(b));
  const isNatural = customer.type === "NATURAL";
  const idLabel = isNatural ? "کد ملی" : "شناسه ملی";
  const idValue = isNatural ? customer.nationalId : customer.nationalEntityId;
  const dateLabel = isNatural ? "تاریخ تولد" : "تاریخ تأسیس";
  const dateValue = isNatural ? customer.birthDate : customer.foundingDate;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <Link
          href={user.role === "EMPLOYEE" ? "/employee/customers" : "/customers"}
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به فهرست مشتریان
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text break-words">{name}</h1>
        <span
          className={`rounded-badge px-2.5 py-0.5 text-xs ${
            customer.status ? "bg-success-bg text-success" : "bg-disabled-bg text-disabled"
          }`}
        >
          {customer.status ? "فعال" : "غیرفعال"}
        </span>
        <span className="text-sm text-text-secondary">{CUSTOMER_TYPE_LABELS[customer.type]}</span>
        <span className="text-sm text-text-secondary" dir="ltr">{customer.code}</span>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {mayCreateCase && (
          <Link
            href={`/cases/new?customerId=${customer.id}`}
            className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:min-h-0 sm:py-2"
          >
            ثبت پرونده جدید
          </Link>
        )}
        {mayEdit && (
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex min-h-[44px] items-center rounded-control border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-page sm:min-h-0 sm:py-2"
          >
            ویرایش
          </Link>
        )}
      </div>
      {/* Top card: contact info, identity, and greeting state. */}
      <section className="mb-6 rounded-card border border-border bg-card p-6 shadow-card">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-secondary">موبایل</dt>
            <dd className="mt-0.5 text-text" dir="ltr">{toPersianDigits(customer.mobile)}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">{idLabel}</dt>
            <dd className="mt-0.5 text-text" dir="ltr">
              {idValue ? toPersianDigits(idValue) : "—"}
            </dd>
          </div>
          {!isNatural && (
            <div>
              <dt className="text-sm text-text-secondary">شماره ثبت</dt>
              <dd className="mt-0.5 text-text" dir="ltr">
                {customer.registrationNumber ? toPersianDigits(customer.registrationNumber) : "—"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-text-secondary">{dateLabel}</dt>
            <dd className="mt-0.5 text-text" dir="ltr">
              {dateValue ? toPersianDigits(dateValue) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">تلفن ثابت</dt>
            <dd className="mt-0.5 text-text" dir="ltr">
              {customer.landline ? toPersianDigits(customer.landline) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">شهر</dt>
            <dd className="mt-0.5 text-text">{customer.city ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">پیام تبریک تولد</dt>
            <dd className="mt-0.5 text-text">{customer.sendGreeting ? "فعال" : "غیرفعال"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-text-secondary">آدرس</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-text">{customer.address ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-text-secondary">توضیحات</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-text">{customer.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>
      {/* Cases: status, current stage, path progress, and per-case balance —
          all computed at read time. Empty until cases exist (Phase 9). */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text">پرونده‌ها</h2>
          <span className="text-sm text-text-secondary">
            مانده کل: <span className="font-medium text-text">{balanceText(page.totalBalance)}</span>
          </span>
        </div>
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-page text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">شماره</th>
                  <th className="px-4 py-3 font-medium">خدمت</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">مرحلهٔ جاری</th>
                  <th className="px-4 py-3 font-medium">پیشرفت</th>
                  <th className="px-4 py-3 font-medium">مانده</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {page.cases.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 text-text-secondary" dir="ltr">{toPersianDigits(c.number)}</td>
                    <td className="px-4 py-3 text-text break-words">{c.serviceName}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {CASE_STATUS_LABELS[c.status as keyof typeof CASE_STATUS_LABELS] ?? c.status}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{c.currentStageTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-text" dir="ltr">
                      {toPersianDigits(`${c.stagesDone}/${c.stagesTotal}`)}
                    </td>
                    <td className="px-4 py-3 text-text">{balanceText(c.balance)}</td>
                    <td className="px-4 py-3 text-left">
                      <Link href={`/cases/${c.id}`} className="text-sm text-primary hover:underline">
                        مشاهده
                      </Link>
                    </td>
                  </tr>
                ))}
                {page.cases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                      هنوز پرونده‌ای ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Follow-up timeline across all of this customer's cases, newest first. */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-text">پیگیری‌ها</h2>
        {page.followUps.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-6 text-center text-sm text-text-secondary shadow-card">
            پیگیری‌ای ثبت نشده است.
          </div>
        ) : (
          <ol className="space-y-3">
            {page.followUps.map((f) => (
              <li key={f.id} className="rounded-card border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">{f.resultTitle}</span>
                  <span className="text-xs text-text-secondary" dir="ltr">
                    {formatJalali(toJalali(f.createdAt), { persianDigits: true })}
                  </span>
                </div>
                {f.note && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-text">{f.note}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-text-secondary">
                  <span dir="ltr">پرونده {toPersianDigits(f.caseNumber)}</span>
                  <span>{f.authorName}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mayManage && (
        <section className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="mb-3 text-lg font-bold text-text">مدیریت مشتری</h2>
          <CustomerActions customerId={customer.id} status={customer.status} caseCount={page.caseCount} />
        </section>
      )}
    </main>
  );
}
