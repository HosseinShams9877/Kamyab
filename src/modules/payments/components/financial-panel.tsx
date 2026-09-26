"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import { formatToman } from "@/lib/money";
// Isomorphic leaf imports (client-component exception): never the payments barrel.
import type {
  PaymentRow,
  PaymentMethodOption,
  PaymentPeriodOption,
} from "../payments.types";
import { paymentPeriodLabel } from "../lib/labels";

// The interactive Financial panel (C-7), hosted in the case page's Payments tab.
// It owns the three actions — record a payment, adjust a period's total, delete a
// payment (with an inline confirm) — and the payment list. A client leaf: it
// imports only isomorphic leaves and calls the guarded financial API routes, then
// refreshes the server component so paid/balance/label recompute (rule 2 — never
// stored). The server re-checks every request (rule 3); `canRecord`/`canAdjust`
// only decide which controls are shown.

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const smallBtn =
  "min-h-[36px] rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const label = "mb-1 block text-xs text-text-secondary";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

export function FinancialPanel({
  payments,
  methods,
  periods,
  defaultPeriodId,
  canRecord,
  canAdjust,
}: {
  payments: PaymentRow[];
  methods: PaymentMethodOption[];
  periods: PaymentPeriodOption[];
  defaultPeriodId: string | null;
  canRecord: boolean;
  canAdjust: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "record" | "adjust">("none");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fallbackPeriod = defaultPeriodId ?? periods[0]?.id ?? "";
  const [amount, setAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(fallbackPeriod);
  const [note, setNote] = useState("");
  const [adjustPeriodId, setAdjustPeriodId] = useState(fallbackPeriod);
  const [totalAmount, setTotalAmount] = useState("");

  const working = busy || pending;
  const multiPeriod = periods.length > 1;

  async function call(method: string, url: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "خطا در انجام عملیات.");
        return;
      }
      // Reset the transient inputs; keep the picked method/period for the next entry.
      setAmount("");
      setReceiptDate("");
      setNote("");
      setTotalAmount("");
      setMode("none");
      setConfirmingId(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const submitRecord = () =>
    call("POST", "/api/cases/payments", { periodId, methodId, amount, receiptDate, note });
  const submitAdjust = () =>
    call("PATCH", "/api/cases/period-total", { periodId: adjustPeriodId, totalAmount });
  const remove = (id: string) => call("DELETE", `/api/cases/payments/${id}`);

  // BODY_PLACEHOLDER
  const methodMissing = methods.length === 0;
  return (
    <div>
      {(canRecord || canAdjust) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {canRecord && (
            <button
              type="button"
              onClick={() => setMode(mode === "record" ? "none" : "record")}
              disabled={working}
              className={primaryBtn}
            >
              ثبت پرداخت
            </button>
          )}
          {canAdjust && (
            <button
              type="button"
              onClick={() => setMode(mode === "adjust" ? "none" : "adjust")}
              disabled={working}
              className={ghostBtn}
            >
              اصلاح مبلغ کل
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {mode === "record" && canRecord && (
        <div className="mb-4 rounded-card border border-border bg-card p-4 shadow-card">
          {methodMissing && (
            <p className="mb-3 rounded-control bg-warning-bg px-3 py-2 text-xs text-warning">
              ابتدا از تنظیمات یک روش پرداخت فعال تعریف کنید.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="pay-amount">مبلغ (تومان)</label>
              <input
                id="pay-amount"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="pay-date">تاریخ دریافت</label>
              <input
                id="pay-date"
                type="text"
                dir="ltr"
                placeholder="۱۴۰۳/۰۵/۰۱"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="pay-method">روش پرداخت</label>
              <select
                id="pay-method"
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                disabled={working || methodMissing}
                className={field}
              >
                {methodMissing && <option value="">—</option>}
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            {multiPeriod && (
              <div>
                <label className={label} htmlFor="pay-period">برای کدام دوره</label>
                <select
                  id="pay-period"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  disabled={working}
                  className={field}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={label} htmlFor="pay-note">یادداشت (اختیاری)</label>
              <input
                id="pay-note"
                type="text"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submitRecord}
              disabled={working || methodMissing || !amount.trim() || !receiptDate.trim() || !methodId || !periodId}
              className={primaryBtn}
            >
              ثبت
            </button>
            <button type="button" onClick={() => setMode("none")} disabled={working} className={ghostBtn}>
              انصراف
            </button>
          </div>
        </div>
      )}
      {/* ADJUST_PLACEHOLDER */}
      {mode === "adjust" && canAdjust && (
        <div className="mb-4 rounded-card border border-border bg-card p-4 shadow-card">
          <p className="mb-3 text-xs text-text-secondary">
            فقط مبلغ کل این دوره تغییر می‌کند؛ پرداخت‌ها دست‌نخورده می‌مانند. برای پاک‌کردن، فیلد را خالی بگذارید.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {multiPeriod && (
              <div>
                <label className={label} htmlFor="adj-period">دوره</label>
                <select
                  id="adj-period"
                  value={adjustPeriodId}
                  onChange={(e) => setAdjustPeriodId(e.target.value)}
                  disabled={working}
                  className={field}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={label} htmlFor="adj-total">مبلغ کل (تومان)</label>
              <input
                id="adj-total"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={working}
                className={field}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submitAdjust}
              disabled={working || !adjustPeriodId}
              className={primaryBtn}
            >
              ثبت
            </button>
            <button type="button" onClick={() => setMode("none")} disabled={working} className={ghostBtn}>
              انصراف
            </button>
          </div>
        </div>
      )}
      {/* LIST_PLACEHOLDER */}
      {payments.length === 0 ? (
        <div className={placeholder}>هنوز پرداختی ثبت نشده است.</div>
      ) : (
        <ul className="space-y-2">
          {payments.map((p) => (
            <li
              key={p.id}
              className="rounded-card border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">
                  {formatToman(p.amount)}
                </span>
                <span className="text-xs text-text-secondary" dir="ltr">
                  {toPersianDigits(p.receiptDate)}
                </span>
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                <div className="flex gap-1">
                  <dt>روش:</dt>
                  <dd className="text-text">{p.methodTitle}</dd>
                </div>
                {multiPeriod && (
                  <div className="flex gap-1">
                    <dt>دوره:</dt>
                    <dd className="text-text">{paymentPeriodLabel(p.periodIndex)}</dd>
                  </div>
                )}
                <div className="flex gap-1">
                  <dt>ثبت‌کننده:</dt>
                  <dd className="text-text">{p.recordedByName}</dd>
                </div>
              </dl>
              {p.note && (
                <p className="mt-2 rounded-control bg-page px-3 py-2 text-xs text-text">
                  {p.note}
                </p>
              )}
              {canRecord && (
                <div className="mt-3">
                  {confirmingId === p.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-secondary">این پرداخت حذف شود؟</span>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={working}
                        className={`${smallBtn} text-error`}
                      >
                        بله، حذف کن
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={working}
                        className={smallBtn}
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(p.id)}
                      disabled={working}
                      className={`${smallBtn} text-error`}
                    >
                      حذف
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
