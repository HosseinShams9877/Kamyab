"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";
import type { EmployeeOption, Workload } from "@/modules/employees/employees.types";

// Deactivation flow (C-12). A first attempt is made without a successor; if the
// server reports active work, we reveal the successor picker and retry with the
// chosen owner. All guards are enforced server-side — this UI only guides.

type Props = {
  employeeId: string;
  isSelf: boolean;
  candidates: EmployeeOption[];
};

type ServerResult =
  | { ok: true; transferred: Workload }
  | { ok: false; reason: string; message: string; workload?: Workload };

export function DeactivatePanel({ employeeId, isSelf, candidates }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [needSuccessor, setNeedSuccessor] = useState(false);
  const [successorId, setSuccessorId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function attempt(withSuccessor: string | null) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successorId: withSuccessor ?? "" }),
      });
      const data = (await res.json()) as ServerResult;
      if (res.ok && data.ok) {
        const t = data.transferred;
        const moved =
          t.activeCases + t.openTasks > 0
            ? ` ${toPersianDigits(String(t.activeCases))} پرونده و ${toPersianDigits(
                String(t.openTasks),
              )} وظیفه منتقل شد.`
            : "";
        setMessage({ ok: true, text: `کارمند غیرفعال شد.${moved}` });
        setNeedSuccessor(false);
        router.refresh();
        return;
      }
      if (!data.ok && data.reason === "successor_required") {
        setNeedSuccessor(true);
        setMessage({ ok: false, text: data.message });
        return;
      }
      setMessage({ ok: false, text: (data as { message?: string }).message ?? "عملیات ناموفق بود." });
    } catch {
      setMessage({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  if (isSelf) {
    return (
      <p className="text-sm text-text-secondary">
        شما نمی‌توانید حساب خود را غیرفعال کنید.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className={`text-sm ${message.ok ? "text-primary" : "text-error"}`}>{message.text}</p>
      )}

      {needSuccessor && (
        <div className="space-y-2">
          <label htmlFor="successor" className="block text-sm font-medium text-text">
            مالک جدید برای پرونده‌ها و وظایف
          </label>
          <select
            id="successor"
            value={successorId}
            onChange={(e) => setSuccessorId(e.target.value)}
            className="w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none focus:border-primary"
          >
            <option value="">— انتخاب کنید —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !successorId}
            onClick={() => attempt(successorId)}
            className="rounded-control bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:bg-disabled-bg disabled:text-disabled"
          >
            {busy ? "در حال انتقال…" : "انتقال کار و غیرفعال‌سازی"}
          </button>
        </div>
      )}

      {!needSuccessor && (
        <button
          type="button"
          disabled={busy}
          onClick={() => attempt(null)}
          className="rounded-control bg-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:bg-disabled-bg disabled:text-disabled"
        >
          {busy ? "در حال بررسی…" : "غیرفعال‌سازی کارمند"}
        </button>
      )}
    </div>
  );
}
