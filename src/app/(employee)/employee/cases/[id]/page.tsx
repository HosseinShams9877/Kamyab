import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import {
  getCasePage,
  CaseTabs,
  CASE_STATUS_LABELS,
  CASE_STATUS_BADGE,
  canEditStages,
  canAddStages,
  canRegisterRenewal,
  canRecordRenewalFollowUp,
  getRenewalMeta,
  canCancelCase,
  canRestoreCase,
  getCancellationDetail,
  CaseCancelDialog,
  CaseRestoreButton,
  canChangeOwner,
  getOwnerChangeMeta,
  CaseChangeOwnerDialog,
} from "@/modules/cases";
import { periodPathTitle, PeriodsPanel } from "@/modules/periods";
import { listActiveCancellationReasons } from "@/modules/settings";
import { countOpenTasksForCase, getTaskFormData, TaskForm } from "@/modules/tasks";
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
import {
  listCaseFollowUps,
  listLatestFollowUpByPeriod,
  FollowUpTimeline,
} from "@/modules/followups";

// Employee case detail page (C-15). Same layout as the manager page, but
// everything scoped to /employee so navigation stays inside the employee shell.

export default async function EmployeeCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "cases.view_all") && !can(user, "cases.view_own")) {
    redirect("/employee");
  }

  const { id } = await params;
  const page = await getCasePage(id);
  if (!page) notFound();

  const { header, periods, current } = page;

  if (!can(user, "cases.view_all") && header.ownerId !== user.id) {
    redirect("/employee");
  }

  const canEdit = canEditStages(user, header.ownerId);
  const canAddStage = canAddStages(user, header.ownerId);
  const isCancelled = header.status === "CANCELLED";

  const canChangeOwnerFlag = canChangeOwner(user, header.ownerId);
  const ownerChangeMeta = canChangeOwnerFlag
    ? await getOwnerChangeMeta(header.id)
    : null;

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

  const paymentsPanel = canViewFin ? (
    financial && (
      <FinancialPanel
        key="payments"
        payments={financial.payments}
        methods={financial.methods}
        periods={financial.periods}
        defaultPeriodId={current?.id ?? null}
        canRecord={canRecordPay}
        canAdjust={canAdjustTot}
      />
    )
  ) : (
    <div
      key="payments-forbidden"
      className="rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card"
    >
      شما مجاز به مشاهدهٔ اطلاعات مالی این پرونده نیستید.
    </div>
  );

  const followUps = await listCaseFollowUps(header.id);
  const tasksPanel = <FollowUpTimeline key="tasks" followUps={followUps} />;

  // The task-create form, composed here with this case's presets. Composed only
  // when the user may create tasks — a slot the server never builds is a slot the
  // client can never open.
  const canCreateTask = can(user, "tasks.create");
  const taskFormData = canCreateTask ? await getTaskFormData(user) : null;
  const taskForm =
    canCreateTask && taskFormData ? (
      <TaskForm
        key="new-task"
        data={taskFormData}
        defaultCaseId={header.id}
        defaultCustomerId={header.customerId}
      />
    ) : null;

  const canRenew = canRegisterRenewal(user, header.ownerId);
  const canRecordRenewalFu = canRecordRenewalFollowUp(user, header.ownerId);
  const [renewalMeta, latestFollowUps] = await Promise.all([
    getRenewalMeta(header.id),
    listLatestFollowUpByPeriod(header.id),
  ]);
  const periodsPanel = (
    <PeriodsPanel
      key="periods"
      caseId={header.id}
      periods={periods}
      renewalMeta={renewalMeta}
      latestFollowUps={latestFollowUps}
      canRenew={canRenew}
      canRecordFollowUp={canRecordRenewalFu}
    />
  );

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
  const progressPercent =
    header.progressTotal === 0
      ? 0
      : Math.round((header.progressPassed / header.progressTotal) * 100);

  return (
    <main className="mx-auto w-full px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/employee/cases" className="text-sm text-primary hover:underline">
          ← بازگشت به پرونده‌ها
        </Link>
      </div>

      {/* Title row + case-level actions */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text" dir="ltr">
            {toPersianDigits(header.number)}
          </h1>
          <span
            className={`rounded-badge px-2.5 py-0.5 text-xs ${CASE_STATUS_BADGE[header.status]}`}
          >
            {CASE_STATUS_LABELS[header.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCancelled
            ? canRestoreThis && <CaseRestoreButton caseId={header.id} />
            : canCancel && (
                <CaseCancelDialog
                  caseId={header.id}
                  reasons={cancelReasons}
                  openStages={openStages}
                  openTasks={openTaskCount}
                  balance={current?.balance ?? null}
                />
              )}
        </div>
      </div>

      {/* Info card */}
      <section className="mb-4 rounded-card border border-border bg-card p-5 shadow-card">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-text-secondary">مشتری</dt>
            <dd className="mt-1">
              <Link
                href={`/employee/customers/${header.customerId}`}
                className="text-sm text-text hover:text-primary hover:underline"
              >
                {header.customerName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">خدمت</dt>
            <dd className="mt-1 text-sm text-text break-words">
              {header.serviceName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">کارشناس مسئول</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-text">
              <span>{header.ownerName}</span>
              {canChangeOwnerFlag && ownerChangeMeta && (
                <CaseChangeOwnerDialog
                  caseId={header.id}
                  currentOwnerId={ownerChangeMeta.currentOwnerId}
                  candidates={ownerChangeMeta.candidates}
                  openTasks={ownerChangeMeta.openTasks}
                />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">تاریخ شروع</dt>
            <dd className="mt-1 text-sm text-text" dir="ltr">
              {header.startDate ? toPersianDigits(header.startDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">تاریخ انقضا</dt>
            <dd className="mt-1 text-sm text-text" dir="ltr">
              {header.expiryDate ? toPersianDigits(header.expiryDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">وضعیت انقضا</dt>
            <dd className="mt-1 text-sm text-text">{daysText}</dd>
          </div>
        </dl>
      </section>

      {/* Cancellation detail — only when cancelled */}
      {isCancelled && cancellationDetail && (
        <section className="mb-4 rounded-card border border-error bg-error-bg p-4 shadow-card">
          <h2 className="mb-2 text-xs font-bold text-error">اطلاعات لغو</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {cancellationDetail.date && (
              <div className="flex gap-2">
                <dt className="text-text-secondary">تاریخ لغو</dt>
                <dd className="text-text" dir="ltr">
                  {toPersianDigits(cancellationDetail.date)}
                </dd>
              </div>
            )}
            {cancellationDetail.reasonTitle && (
              <div className="flex gap-2">
                <dt className="text-text-secondary">دلیل لغو</dt>
                <dd className="text-text">{cancellationDetail.reasonTitle}</dd>
              </div>
            )}
            {cancellationDetail.cancelledByName && (
              <div className="flex gap-2">
                <dt className="text-text-secondary">لغوکننده</dt>
                <dd className="text-text">{cancellationDetail.cancelledByName}</dd>
              </div>
            )}
            {cancellationDetail.note && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-text-secondary">یادداشت</dt>
                <dd className="text-text break-words">{cancellationDetail.note}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Two summary cards */}
      {current ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs text-text-secondary">
                {periodPathTitle(current.indexNumber)}
              </h2>
              <span className="text-xs text-text-secondary" dir="ltr">
                {toPersianDigits(`${header.progressPassed}/${header.progressTotal}`)}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-text" dir="ltr">
              {toPersianDigits(String(progressPercent))}
              <span className="text-lg">٪</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-badge bg-page">
              <div
                className="h-full rounded-badge bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-secondary">مرحله طی‌شده</p>
          </section>

          {canViewFin && (
            <section className="rounded-card border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs text-text-secondary">وضعیت مالی</h2>
                {financeStatus && (
                  <span
                    className={`rounded-badge px-2 py-0.5 text-xs ${PAYMENT_STATUS_BADGE[financeStatus]}`}
                  >
                    {PAYMENT_STATUS_LABELS[financeStatus]}
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
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
        <div className="mb-6 rounded-card border border-border bg-card p-6 text-center text-sm text-text-secondary shadow-card">
          دورهٔ فعالی برای این پرونده ثبت نشده است.
        </div>
      )}

      <CaseTabs
        current={current}
        canEdit={canEdit}
        canAddStage={canAddStage}
        canCreateTask={canCreateTask}
        isCancelled={isCancelled}
        periodsPanel={periodsPanel}
        paymentsPanel={paymentsPanel}
        tasksPanel={tasksPanel}
        taskForm={taskForm}
      />
    </main>
  );
}