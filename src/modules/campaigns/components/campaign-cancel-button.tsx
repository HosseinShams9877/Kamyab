"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// A tiny standalone cancel button (used from the list, if needed). The detail
// page uses CampaignSendPanel which already includes both actions.

export function CampaignCancelButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? "لغو کمپین انجام نشد.");
        return;
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-control border border-error bg-error-bg px-4 text-sm text-error transition-colors hover:bg-error-bg/70"
      >
        لغو کمپین
      </button>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
      <ConfirmDialog
        open={open}
        title="لغو کمپین"
        description="این کمپین لغو شود؟ گیرندگان در صف ارسال نخواهند شد."
        confirmLabel="لغو کن"
        cancelLabel="انصراف"
        tone="danger"
        busy={busy || pending}
        onConfirm={cancel}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}