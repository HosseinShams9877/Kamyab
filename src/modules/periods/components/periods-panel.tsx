import type { ReactNode } from "react";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
import type { PeriodRow, RenewalMeta, PeriodCardFollowUp } from "../periods.types";
import {
  PERIOD_STATUS_LABELS,
  PERIOD_STATUS_BADGE,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_BADGE,
  periodPathTitle,
} from "../lib/labels";
import { RenewalForm } from "./renewal-form";
import { RenewalFollowUpForm } from "./renewal-follow-up-form";

// The Periods tab of the case page (C-9). A server component (composed on the
// case page and handed to the client CaseTabs as a slot) so it can read labels +
// money formatting without pulling the module barrel into the client bundle; the
// two interactive forms it embeds on the active card are the only client leaves.
// One card per validity span (newest first, as the service returns them): title ·
// status + follow-up badges · date range · the three read-time financials (rule 2)
// · a path-progress bar with its number · the last follow-up. The renewal + the
// follow-up forms appear only on the ACTIVE period, and only when the viewer is
// permitted (the server re-checks every request, rule 3 — these flags just decide
// what is shown).

const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

// A stage is "passed" when Done or explicitly Not Needed (mirrors the service).
const PASSED = ["DONE", "NOT_NEEDED"];

function progress(period: PeriodRow): { passed: number; total: number; pct: number } {
  const total = period.stages.length;
  const passed = period.stages.filter((s) => PASSED.includes(s.status)).length;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
  return { passed, total, pct };
}

function Figure({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{term}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

export function PeriodsPanel({
  caseId,
  periods,
  renewalMeta,
  latestFollowUps,
  canRenew,
  canRecordFollowUp,
}: {
  caseId: string;
  periods: PeriodRow[];
  renewalMeta: RenewalMeta | null;
  latestFollowUps: Record<string, PeriodCardFollowUp>;
  canRenew: boolean;
  canRecordFollowUp: boolean;
}) {
  if (periods.length === 0) {
    return <div className={placeholder}>دوره‌ای ثبت نشده است.</div>;
  }

  return (
    <ul className="space-y-3">
      {periods.map((period) => {
        const isActive = period.status === "ACTIVE";
        const { passed, total, pct } = progress(period);
        const followUp = latestFollowUps[period.id] ?? null;
        const showRenewal = isActive && canRenew && renewalMeta?.renewable === true;
        const showFollowUp = isActive && canRecordFollowUp;

        return (
          <li
            key={period.id}
            className={`rounded-card border bg-card p-4 shadow-card ${
              isActive ? "border-primary" : "border-border"
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text">
                {periodPathTitle(period.indexNumber)}
              </span>
              <span className={`${badge} ${PERIOD_STATUS_BADGE[period.status]}`}>
                {PERIOD_STATUS_LABELS[period.status]}
              </span>
              <span className={`${badge} ${FOLLOW_UP_STATUS_BADGE[period.followUpStatus]}`}>
                {FOLLOW_UP_STATUS_LABELS[period.followUpStatus]}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <Figure term="تاریخ شروع" value={<span dir="ltr">{toPersianDigits(period.startDate)}</span>} />
              <Figure
                term="تاریخ انقضا"
                value={period.expiryDate ? <span dir="ltr">{toPersianDigits(period.expiryDate)}</span> : "—"}
              />
              <Figure term="مبلغ کل" value={period.totalAmount === null ? "—" : formatToman(period.totalAmount)} />
              <Figure term="پرداخت‌شده" value={formatToman(period.paid)} />
              <Figure term="مانده" value={period.balance === null ? "—" : formatToman(period.balance)} />
            </dl>

            {total > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                  <span>پیشرفت مسیر</span>
                  <span dir="ltr">
                    {toPersianDigits(String(passed))}/{toPersianDigits(String(total))}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-badge bg-page">
                  <div className="h-full rounded-badge bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {followUp && (
              <p className="mt-3 rounded-control bg-page px-3 py-2 text-xs text-text-secondary">
                آخرین پیگیری: <span className="text-text">{followUp.name}</span>
                {" — "}
                <span dir="ltr">{toPersianDigits(followUp.date)}</span>
                {followUp.note ? <span className="text-text">{` — ${followUp.note}`}</span> : null}
              </p>
            )}

            {(showRenewal || showFollowUp) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {showRenewal && renewalMeta && <RenewalForm caseId={caseId} meta={renewalMeta} />}
                {showFollowUp && (
                  <RenewalFollowUpForm caseId={caseId} currentStatus={period.followUpStatus} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
