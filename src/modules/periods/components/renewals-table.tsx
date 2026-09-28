"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import type { RenewalRow, RenewalListParams } from "../periods.types";
import { FOLLOW_UP_STATUS_LABELS, FOLLOW_UP_STATUS_BADGE } from "../lib/labels";

// The renewals work-queue table (C-10): filter bar + table.

export type RenewalTableRow = RenewalRow & {
  canAbandon: boolean;
  canRestore: boolean;
};

const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const smallBtn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary";

const FOLLOW_UP_OPTIONS = [
  "NOT_FOLLOWED_UP",
  "CONTACTED",
  "AWAITING_CUSTOMER",
  "AGREES_TO_RENEW",
  "NOT_INTERESTED",
] as const;

function daysLabel(d: number | null): { text: string; tone: string } {
  if (d === null) return { text: "—", tone: "text-text-secondary" };
  if (d < 0) return { text: `${toPersianDigits(String(-d))} روز گذشته`, tone: "text-error" };
  return { text: `${toPersianDigits(String(d))} روز مانده`, tone: "text-text" };
}

type Props = {
  rows: RenewalTableRow[];
  params: RenewalListParams;
  owners: { id: string; fullName: string }[];
  services: { id: string; name: string }[];
  basePath: string;
  currentTab: string;
};

export function RenewalsTable({
  rows,
  params,
  owners,
  services,
  basePath,
  currentTab,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; op: "abandon" | "restore" } | null>(
    null,
  );

  const working = busy || pending;

  async function act(op: "abandon" | "restore", periodId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/renewals/${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "خطا در انجام عملیات.");
        return;
      }
      setConfirming(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-b-card border border-t-0 border-border bg-card shadow-card">
        {/* Filter bar */}
        <form
          method="get"
          action={basePath}
          className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="tab" value={currentTab} />
          <div className="sm:col-span-2">
            <input
              name="q"
              type="text"
              defaultValue={params.q ?? ""}
              placeholder="نام مشتری، موبایل یا شماره پرونده…"
              className={inputClass}
            />
          </div>
          <div>
            <select name="serviceId" defaultValue={params.serviceId ?? ""} className={inputClass}>
              <option value="">خدمت</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select name="ownerId" defaultValue={params.ownerId ?? ""} className={inputClass}>
              <option value="">مسئول</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              name="followUpStatus"
              defaultValue={params.followUpStatus ?? ""}
              className={inputClass}
            >
              <option value="">وضعیت پیگیری</option>
              {FOLLOW_UP_OPTIONS.map((s) => (
                <option key={s} value={s}>{FOLLOW_UP_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-4 lg:justify-end">
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
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">خدمت</th>
                <th className="px-4 py-3 font-medium">شمارهٔ پرونده</th>
                <th className="px-4 py-3 font-medium">تاریخ انقضا</th>
                <th className="px-4 py-3 font-medium">باقی‌مانده</th>
                <th className="px-4 py-3 font-medium">مسئول</th>
                <th className="px-4 py-3 font-medium">پیگیری</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const days = daysLabel(r.daysRemaining);
                const showAbandon = r.canAbandon && r.status === "ACTIVE" && r.abandonable;
                const showRestore = r.canRestore && r.status === "ABANDONED";
                const isConfirming = confirming?.id === r.periodId;
                return (
                  <tr
                    key={r.periodId}
                    onClick={() => router.push(`/cases/${r.caseId}`)}
                    className="cursor-pointer border-t border-border hover:bg-page"
                  >
                    <td className="px-4 py-3">
                      <div className="text-text font-medium break-words">{r.customerName}</div>
                      <div className="mt-1 text-xs text-text-secondary" dir="ltr">
                        {toPersianDigits(r.customerMobile)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.serviceName}</td>
                    <td className="px-4 py-3 text-text" dir="ltr">
                      {toPersianDigits(r.caseNumber)}
                    </td>
                    <td className="px-4 py-3 text-text" dir="ltr">
                      {r.expiryDate ? toPersianDigits(r.expiryDate) : "—"}
                    </td>
                    <td className={`px-4 py-3 ${days.tone}`}>{days.text}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.ownerName}</td>
                    <td className="px-4 py-3">
                      <span className={`${badge} ${FOLLOW_UP_STATUS_BADGE[r.followUpStatus]}`}>
                        {FOLLOW_UP_STATUS_LABELS[r.followUpStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isConfirming && confirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">مطمئن هستید؟</span>
                          <button
                            type="button"
                            onClick={() => act(confirming.op, r.periodId)}
                            disabled={working}
                            className={`${smallBtn} ${
                              confirming.op === "abandon" ? "text-error" : "text-primary"
                            }`}
                          >
                            بله
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            disabled={working}
                            className={smallBtn}
                          >
                            انصراف
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/cases/${r.caseId}`)}
                            className="inline-flex min-h-[36px] items-center rounded-control bg-primary px-3 text-xs text-white transition-colors hover:bg-primary-hover"
                          >
                            ثبت تمدید
                          </button>
                          {showAbandon && (
                            <button
                              type="button"
                              onClick={() => setConfirming({ id: r.periodId, op: "abandon" })}
                              disabled={working}
                              className={`${smallBtn} text-error`}
                            >
                              رها کردن
                            </button>
                          )}
                          {showRestore && (
                            <button
                              type="button"
                              onClick={() => setConfirming({ id: r.periodId, op: "restore" })}
                              disabled={working}
                              className={smallBtn}
                            >
                              بازگردانی
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    دوره‌ای در این نما وجود ندارد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}