"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The send/cancel panel on the campaign detail page. Two buttons:
// - "ارسال کمپین": snapshots the audience (idempotent) and marks it RUNNING
//   so the engine picks it up.
// - "لغو کمپین": only for active/scheduled campaigns.

const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "min-h-[44px] rounded-control border border-error bg-error-bg px-4 text-sm text-error transition-colors hover:bg-error-bg/70 disabled:cursor-not-allowed disabled:opacity-50";

export function CampaignSendPanel({
  campaignId,
  canSend,
  canCancel,
  sendable,
  cancellable,
  recipientCount,
}: {
  campaignId: string;
  canSend: boolean;
  canCancel: boolean;
  sendable: boolean;
  cancellable: boolean;
  recipientCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(url: string, okText: string) {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        message?: string;
      };
      if (res.ok && d.ok) {
        setMsg({ ok: true, text: okText });
        startTransition(() => router.refresh());
        return;
      }
      setMsg({ ok: false, text: d.message ?? "عملیات انجام نشد." });
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canSend && sendable && (
          <button
            type="button"
            onClick={() =>
              run(
                `/api/campaigns/${campaignId}/send`,
                "کمپین آمادهٔ ارسال شد. موتور خودکار در اجرای بعدی پیام‌ها را ارسال می‌کند.",
              )
            }
            disabled={busy || pending}
            className={primaryBtn}
          >
            {busy ? "در حال ارسال…" : "ارسال کمپین"}
          </button>
        )}
        {canCancel && cancellable && (
          <button
            type="button"
            onClick={() =>
              run(`/api/campaigns/${campaignId}/cancel`, "کمپین لغو شد.")
            }
            disabled={busy || pending}
            className={dangerBtn}
          >
            لغو کمپین
          </button>
        )}
        <span className="text-xs text-text-secondary">
          {recipientCount > 0
            ? `${recipientCount} گیرنده در فهرست`
            : "برای ارسال، ابتدا گیرندگان شناسایی می‌شوند."}
        </span>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}