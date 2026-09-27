import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getCasePage, CaseTabs, CASE_STATUS_LABELS, CASE_STATUS_BADGE, canEditStages, canAddStages, canRegisterRenewal, canRecordRenewalFollowUp, getRenewalMeta, canCancelCase, canRestoreCase, getCancellationDetail, CaseCancelDialog, CaseRestoreButton } from "@/modules/cases";
import { periodPathTitle, PeriodsPanel } from "@/modules/periods";
import { listActiveCancellationReasons } from "@/modules/settings";
import { countOpenTasksForCase } from "@/modules/tasks";
import {
  getCaseFinancial,
  canViewFinancial,
  canRecordPayments,
  canAdjustTotal,
  paymentStatus,
  paymentPercent,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_BADGE,
  FinancialPanel,
} from "@/modules/payments";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
import { listCaseFollowUps, listLatestFollowUpByPeriod, FollowUpTimeline } from "@/modules/followups";

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
  const home = user.role === "EMPLOYEE" ? "/employee" : "/dashboard";
  if (!can(user, "cases.view_all") && !can(user, "cases.view_own")) {
    redirect(home);
  }

  const { id } = await params;
  const page = await getCasePage(id);
  if (!page) notFound();

  const { header, periods, current } = page;

  // Ownership gate (rule 3): without cases.view_all, a user may open only a case
  // they own. This shared /cases/[id] route serves both a manager (view_all) and
  // the owning employee (view_own) — the per-action capabilities below are all
  // scoped to header.ownerId, and every mutation API re-checks.
  if (!can(user, "cases.view_all") && header.ownerId !== user.id) {
    redirect(home);
  }

  // Server-side authorization for the stage engine (rule 3): the same booleans
  // gate the API routes. They decide only whether the buttons are shown; the
  // routes re-check on every request.
  const canEdit = canEditStages(user, header.ownerId);
  const canAddStage = canAddStages(user, header.ownerId);
  const isCancelled = header.status === "CANCELLED";

  // Financial card + Payments tab (C-7). Viewing needs `financial.view`; the two
  // mutation permissions are record-scoped (paired with cases.edit on the owner).
  // Paid/balance are read from the current period (periods computes them, rule 2);
  // the status label + percentage are computed here from total + paid.
  const canViewFin = canViewFinancial(user);
  const canRecordPay = canRecordPayments(user, header.ownerId);
  const canAdjustTot = canAdjustTotal(user, header.ownerId);
  const financial = canViewFin ? await getCaseFinancial(header.id) : null;

  const financeStatus = current
    ? paymentStatus(current.totalAmount, current.paid)
    : null;
  const financePercent = current
    ? paymentPercent(current.totalAmount, current.paid)
    : null;

  // The Payments tab body (C-7). Composed here on the server and handed to the
  // client CaseTabs as a slot, so CaseTabs never imports the payments barrel
  // (which would pull server-only code into the client bundle). Gated by
  // `financial.view`; the panel's own controls are gated by the record/adjust
  // booleans, and the API routes re-check on every request (rule 3).
  const paymentsPanel = canViewFin ? (
    financial && (
      <FinancialPanel
        payments={financial.payments}
        methods={financial.methods}
        periods={financial.periods}
        defaultPeriodId={current?.id ?? null}
        canRecord={canRecordPay}
        canAdjust={canAdjustTot}
      />
    )
  ) : (
    <div className="rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
      شما مجاز به مشاهدهٔ اطلاعات مالی این پرونده نیستید.
    </div>
  );

  // The Tasks tab body (C-11): the case's follow-up timeline, composed on the
  // server and handed to the client CaseTabs as a slot (so it never imports the
  // followups barrel). The tasks themselves are managed on the /tasks page.
  const followUps = await listCaseFollowUps(header.id);
  const tasksPanel = <FollowUpTimeline followUps={followUps} />;

  // The Periods tab body (C-9): one card per validity span with the renewal +
  // renewal-follow-up forms on the active period. Composed on the server so the
  // client CaseTabs never imports the periods barrel. The renewal meta drives the
  // form (renewable flag, durations, default start); the latest-follow-up map feeds
  // each card's "last follow-up" line. The two capability flags are record-scoped
  // (rule 3); the API routes re-check every request.
  const canRenew = canRegisterRenewal(user, header.ownerId);
  const canRecordRenewalFu = canRecordRenewalFollowUp(user, header.ownerId);
  const [renewalMeta, latestFollowUps] = await Promise.all([
    getRenewalMeta(header.id),
    listLatestFollowUpByPeriod(header.id),
  ]);
  const periodsPanel = (
    <PeriodsPanel
      caseId={header.id}
      periods={periods}
      renewalMeta={renewalMeta}
      latestFollowUps={latestFollowUps}
      canRenew={canRenew}
      canRecordFollowUp={canRecordRenewalFu}
    />
  );

  // Case cancellation & restore (C-8). Cancel is offered on an open case
  // (NEW/IN_PROGRESS) to a user with `cases.cancel` scoped to the owner; restore
  // is MANAGER ONLY on a cancelled case. The API routes + service re-check both
  // (rule 3). The cancel dialog's warning summary is computed here: open stages
  // (progress gap), open tasks (tasks module), and the current period's balance.
  const cancellable = header.status === "NEW" || header.status === "IN_PROGRESS";
  const canCancel = cancellable && canCancelCase(user, header.ownerId);
  const canRestoreThis = isCancelled && canRestoreCase(user, user.role, header.ownerId);
  const [cancelReasons, openTaskCount, cancellationDetail] = await Promise.all([
    canCancel ? listActiveCancellationReasons() : Promise.resolve([]),
    canCancel ? countOpenTasksForCase(header.id) : Promise.resolve(0),
    isCancelled ? getCancellationDetail(header.id) : Promise.resolve(null),
  ]);
  const openStages = Math.max(header.progressTotal - header.progressPassed, 0);

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

      {/* Cancellation controls / detail (C-8). */}
      {(canCancel || isCancelled) && (
        <section className="mb-6 rounded-card border border-border bg-card p-4 shadow-card">
          {isCancelled ? (
            <div className="flex flex-col gap-3">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {cancellationDetail?.date && (
                  <div className="flex gap-2">
                    <dt className="text-text-secondary">تاریخ لغو</dt>
                    <dd className="text-text" dir="ltr">
                      {toPersianDigits(cancellationDetail.date)}
                    </dd>
                  </div>
                )}
                {cancellationDetail?.reasonTitle && (
                  <div className="flex gap-2">
                    <dt className="text-text-secondary">دلیل لغو</dt>
                    <dd className="text-text">{cancellationDetail.reasonTitle}</dd>
                  </div>
                )}
                {cancellationDetail?.cancelledByName && (
                  <div className="flex gap-2">
                    <dt className="text-text-secondary">لغوکننده</dt>
                    <dd className="text-text">{cancellationDetail.cancelledByName}</dd>
                  </div>
                )}
                {cancellationDetail?.note && (
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="text-text-secondary">یادداشت</dt>
                    <dd className="text-text break-words">{cancellationDetail.note}</dd>
                  </div>
                )}
              </dl>
              {canRestoreThis && <CaseRestoreButton caseId={header.id} />}
            </div>
          ) : (
            <CaseCancelDialog
              caseId={header.id}
              reasons={cancelReasons}
              openStages={openStages}
              openTasks={openTaskCount}
              balance={current?.balance ?? null}
            />
          )}
        </section>
      )}
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
          {canViewFin && (
          <section className="rounded-card border border-border bg-card p-6 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-text-secondary">وضعیت مالی</h2>
              {financeStatus && (
                <span className={`rounded-badge px-2.5 py-0.5 text-xs ${PAYMENT_STATUS_BADGE[financeStatus]}`}>
                  {PAYMENT_STATUS_LABELS[financeStatus]}
                </span>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">مبلغ کل</dt>
                <dd className="text-text">{amountText(current.totalAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">پرداخت‌شده</dt>
                <dd className="text-text">{formatToman(current.paid)}</dd>
              </div>
              {financePercent !== null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-secondary">درصد پرداخت</dt>
                  <dd className="text-text" dir="ltr">
                    {toPersianDigits(String(financePercent))}٪
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <dt className="font-medium text-text">مانده</dt>
                <dd
                  className={`font-medium ${
                    current.balance !== null && current.balance < 0
                      ? "text-warning"
                      : "text-text"
                  }`}
                >
                  {amountText(current.balance)}
                </dd>
              </div>
            </dl>
          </section>
          )}
        </div>
      ) : (
        <div className="mb-8 rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
          دورهٔ فعالی برای این پرونده ثبت نشده است.
        </div>
      )}

      <CaseTabs
        current={current}
        canEdit={canEdit}
        canAddStage={canAddStage}
        isCancelled={isCancelled}
        periodsPanel={periodsPanel}
        paymentsPanel={paymentsPanel}
        tasksPanel={tasksPanel}
      />
    </main>
  );
}
