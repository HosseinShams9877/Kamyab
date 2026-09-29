"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/digits";

// The change-owner control + dialog (C-5). Client leaf: it imports client-safe
// libs only (digits) and posts to /api/cases/[id]/change-owner — never the
// cases barrel (which pulls in Prisma). Authorization + the atomic change live
// in the service (rule 3/4); this only collects the new owner + the "move open
// tasks" toggle, and shows the open-task hint. The confirm button stays
// disabled until a different owner is picked.

const NOTE_MAX = 500;

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 text-sm text-text placeholder:text-text-secondary disabled:opacity-50";
const label = "mb-1 block text-xs text-text-secondary";
const ghostBtn =
  "min-h-[44px] rounded-control border border-border px-4 text-sm text-text hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn =
  "min-h-[44px] rounded-control border border-primary bg-primary px-4 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

export function CaseChangeOwnerDialog({
  caseId,
  currentOwnerId,
  candidates,
  openTasks,
}: {
  caseId: string;
  currentOwnerId: string;
  candidates: { id: string; fullName: string }[];
  openTasks: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [moveOpenTasks, setMoveOpenTasks] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/change-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId, moveOpenTasks, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "تغییر مسئول انجام نشد.");
        return;
      }
      setOpen(false);
      setNewOwnerId("");
      setNote("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => setOpen(true)}
      >
        تغییر مسئول
      </button>
    );
  }

  const canSubmit = newOwnerId !== "" && newOwnerId !== currentOwnerId;

  return (
    <div className="w-full max-w-lg rounded-card border border-border bg-card p-4 shadow-card">
      <h3 className="mb-2 text-sm font-medium text-text">تغییر مسئول پرونده</h3>

      {openTasks > 0 && (
        <div className="mb-3 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning">
          این پرونده {toPersianDigits(String(openTasks))} کار باز دارد.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-control bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      <div className="mb-3">
        <label className={label} htmlFor="new-owner">
          مسئول جدید
        </label>
        <select
          id="new-owner"
          className={field}
          value={newOwnerId}
          disabled={working}
          onChange={(e) => setNewOwnerId(e.target.value)}
        >
          <option value="">— انتخاب مسئول —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </div>

      {openTasks > 0 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={moveOpenTasks}
            disabled={working}
            onChange={(e) => setMoveOpenTasks(e.target.checked)}
          />
          کارهای باز این پرونده هم به مسئول جدید منتقل شوند
        </label>
      )}

      <div className="mb-3">
        <label className={label} htmlFor="owner-note">
          یادداشت (اختیاری)
        </label>
        <textarea
          id="owner-note"
          className={`${field} min-h-[80px] py-2`}
          value={note}
          maxLength={NOTE_MAX}
          disabled={working}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryBtn}
          disabled={working || !canSubmit}
          onClick={submit}
        >
          {working ? "در حال انتقال…" : "تأیید انتقال"}
        </button>
        <button
          type="button"
          className={ghostBtn}
          disabled={working}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          انصراف
        </button>
      </div>
    </div>
  );
}