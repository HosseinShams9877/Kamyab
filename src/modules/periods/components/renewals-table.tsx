"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
// Isomorphic leaf imports (client-component exception): never the periods barrel.
import type { RenewalRow } from "../periods.types";
import { FOLLOW_UP_STATUS_LABELS, FOLLOW_UP_STATUS_BADGE } from "../lib/labels";

// The renewals work-queue table (C-10). A client leaf: a whole row navigates to
// the case, and the last cell owns the Abandon / Restore controls (each behind an
// inline confirm) that POST to the guarded renewal routes and then refresh the
// server view so the row re-classifies (rule 2 — status/days recompute). The two
// per-row flags only decide which buttons show; the server re-authorizes every
// request (rule 3). Table scrolls horizontally inside its own card on narrow
// screens (a scoped scroll, not page overflow — rule 11).

/** A queue row plus the two per-row capability flags the page computes (scoped
 *  permission × case ownership, rule 3). */
export type RenewalTableRow = RenewalRow & {
  canAbandon: boolean;
  canRestore: boolean;
};

const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const smallBtn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";

/** The days-remaining cell: expired (past) is emphasised, ≤7 days is urgent. */
function daysLabel(d: number | null): { text: string; tone: string } {
  if (d === null) return { text: "—", tone: "text-text-secondary" };
  if (d < 0) return { text: `${toPersianDigits(String(-d))} روز گذشته`, tone: "text-error" };
  if (d <= 7) return { text: `${toPersianDigits(String(d))} روز مانده`, tone: "text-warning" };
  return { text: `${toPersianDigits(String(d))} روز مانده`, tone: "text-text" };
}

export function RenewalsTable({ rows }: { rows: RenewalTableRow[] }) {
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

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card">
        دوره‌ای در این نما وجود ندارد.
      </div>
    );
  }

  // TABLE
  return (
    <div>
      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-page text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">شمارهٔ پرونده</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">خدمت</th>
                <th className="px-4 py-3 font-medium">مسئول</th>
                <th className="px-4 py-3 font-medium">تاریخ انقضا</th>
                <th className="px-4 py-3 font-medium">باقی‌مانده</th>
                <th className="px-4 py-3 font-medium">پیگیری</th>
                <th className="px-4 py-3 font-medium">مبلغ کل</th>
                <th className="px-4 py-3 font-medium">مانده</th>
                <th className="px-4 py-3" />
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
                    <td className="px-4 py-3 text-text" dir="ltr">{toPersianDigits(r.caseNumber)}</td>
                    <td className="px-4 py-3 text-text break-words">{r.customerName}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.serviceName}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.ownerName}</td>
                    <td className="px-4 py-3 text-text" dir="ltr">
                      {r.expiryDate ? toPersianDigits(r.expiryDate) : "—"}
                    </td>
                    <td className={`px-4 py-3 ${days.tone}`}>{days.text}</td>
                    <td className="px-4 py-3">
                      <span className={`${badge} ${FOLLOW_UP_STATUS_BADGE[r.followUpStatus]}`}>
                        {FOLLOW_UP_STATUS_LABELS[r.followUpStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text">
                      {r.totalAmount === null ? "—" : formatToman(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-text">
                      {r.balance === null ? "—" : formatToman(r.balance)}
                    </td>
                    <td className="px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
                      {isConfirming && confirming ? (
                        <div className="flex items-center justify-end gap-2">
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
                        <div className="flex items-center justify-end gap-2">
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
                          {!showAbandon && !showRestore && (
                            <span className="text-xs text-text-secondary">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
