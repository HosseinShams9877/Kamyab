import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCasePage, CaseTabs, CASE_STATUS_LABELS, CASE_STATUS_BADGE, canEditStages, canAddStages } from "@/modules/cases";
import { periodPathTitle } from "@/modules/periods";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";

// A single case's page (C-5). Phase 9 read-only shell: a live header (computed
// days-remaining + path progress, never stored — rule 2), a Path card and a
// Financial card frame for the current period, and the five tabs (CaseTabs).
// The six stage actions and payments/tasks/history arrive in later phases.
export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "cases.view_all") && !can(user, "cases.view_own")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const page = await getCasePage(id);
  if (!page) notFound();

  const { header, periods, current } = page;

  // Server-side authorization for the stage engine (rule 3): the same booleans
  // gate the API routes. They decide only whether the buttons are shown; the
  // routes re-check on every request.
  const canEdit = canEditStages(user, header.ownerId);
  const canAddStage = canAddStages(user, header.ownerId);
  const isCancelled = header.status === "CANCELLED";

  const daysText =
    header.daysRemaining === null
      ? "بدون تاریخ انقضا"
      : header.daysRemaining >= 0
        ? `${toPersianDigits(String(header.daysRemaining))} روز تا انقضا`
        : `${toPersianDigits(String(Math.abs(header.daysRemaining)))} روز از انقضا گذشته`;

  const amountText = (v: number | null) => (v === null ? "—" : formatToman(v));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* PAGE_BODY */}
      <div className="mb-6">
        <Link
          href={`/customers/${header.customerId}`}
          className="text-sm text-primary hover:underline"
        >
          ← بازگشت به مشتری
        </Link>
      </div>

      {/* Header: number, status, the two references, and live figures. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text" dir="ltr">
          {toPersianDigits(header.number)}
        </h1>
        <span className={`rounded-badge px-2.5 py-0.5 text-xs ${CASE_STATUS_BADGE[header.status]}`}>
          {CASE_STATUS_LABELS[header.status]}
        </span>
      </div>

      <section className="mb-6 rounded-card border border-border bg-card p-6 shadow-card">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm text-text-secondary">مشتری</dt>
            <dd className="mt-0.5">
              <Link
                href={`/customers/${header.customerId}`}
                className="text-text hover:text-primary hover:underline"
              >
                {header.customerName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">خدمت</dt>
            <dd className="mt-0.5 text-text break-words">{header.serviceName}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">کارشناس مسئول</dt>
            <dd className="mt-0.5 text-text">{header.ownerName}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">تاریخ شروع</dt>
            <dd className="mt-0.5 text-text" dir="ltr">
              {header.startDate ? toPersianDigits(header.startDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">تاریخ انقضا</dt>
            <dd className="mt-0.5 text-text" dir="ltr">
              {header.expiryDate ? toPersianDigits(header.expiryDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">وضعیت انقضا</dt>
            <dd className="mt-0.5 text-text">{daysText}</dd>
          </div>
        </dl>
      </section>
      {/* CARDS_AND_TABS */}
      {/* Two cards for the current period: the path (progress) and the money. */}
      {current ? (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="mb-3 text-sm font-medium text-text-secondary">
              {periodPathTitle(current.indexNumber)}
            </h2>
            <p className="text-2xl font-bold text-text" dir="ltr">
              {toPersianDigits(`${header.progressPassed}/${header.progressTotal}`)}
            </p>
            <p className="mt-1 text-sm text-text-secondary">مرحله طی‌شده</p>
          </section>
          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="mb-3 text-sm font-medium text-text-secondary">وضعیت مالی</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">مبلغ کل</dt>
                <dd className="text-text">{amountText(current.totalAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">پرداخت‌شده</dt>
                <dd className="text-text">{formatToman(current.paid)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <dt className="font-medium text-text">مانده</dt>
                <dd className="font-medium text-text">{amountText(current.balance)}</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : (
        <div className="mb-8 rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
          دورهٔ فعالی برای این پرونده ثبت نشده است.
        </div>
      )}

      <CaseTabs
        current={current}
        periods={periods}
        canEdit={canEdit}
        canAddStage={canAddStage}
        isCancelled={isCancelled}
      />
    </main>
  );
}
