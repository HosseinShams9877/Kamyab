"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Manual "run the engine now" button for the engine page (C-14). Posts to the
// same /api/engine/run endpoint the external scheduler uses, then refreshes the
// page so the new run row appears. Asks for confirmation first (in-app dialog,
// not window.confirm) because a run may send real SMS if "real send" is on.

type RunResult = {
  ok: boolean;
  message?: string;
  summary?: {
    reminders?: number;
    smsSent?: number;
    greetings?: number;
    archived?: number;
    abandoned?: number;
    errors?: number;
  };
};

export function RunEngineButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const working = busy || pending;

  async function run() {
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/engine/run", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as RunResult;
      setResult(
        res.ok && data.ok
          ? { ok: true, summary: data.summary }
          : { ok: false, message: data.message ?? "اجرای موتور ناموفق بود." },
      );
      if (res.ok && data.ok) {
        startTransition(() => router.refresh());
      }
    } catch {
      setResult({ ok: false, message: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={working}
        className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {working ? "در حال اجرا…" : "اجرای موتور"}
      </button>

      {result?.ok && result.summary && (
        <div className="rounded-control bg-success-bg px-3 py-2 text-xs text-success">
          اجرا با موفقیت انجام شد —{" "}
          {result.summary.reminders ?? 0} یادآوری،{" "}
          {result.summary.smsSent ?? 0} پیامک،{" "}
          {result.summary.greetings ?? 0} تبریک،{" "}
          {result.summary.archived ?? 0} بایگانی،{" "}
          {result.summary.abandoned ?? 0} رهاشده
          {(result.summary.errors ?? 0) > 0
            ? ` — ${result.summary.errors} خطا`
            : ""}
        </div>
      )}
      {result && !result.ok && result.message && (
        <div className="rounded-control bg-error-bg px-3 py-2 text-xs text-error">
          {result.message}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="اجرای موتور خودکار"
        description="در صورت فعال بودن «ارسال واقعی پیامک»، ممکن است پیامک واقعی برای مشتریان ارسال شود. اجرا شود؟"
        confirmLabel="اجرا کن"
        cancelLabel="انصراف"
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}