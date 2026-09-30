"use client";

import { useEffect, type ReactNode } from "react";

// A themed confirmation dialog that replaces the browser's window.confirm().
// Renders inside the app (modal overlay + card), so styling, RTL, and Persian
// text stay consistent. Escape closes; clicking the overlay closes; the confirm
// button owns the side effect.

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-error text-white hover:bg-error/90"
      : "bg-primary text-white hover:bg-primary-hover";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-border bg-card p-5 shadow-card">
        <h3 className="mb-2 text-base font-bold text-text">{title}</h3>
        {description && (
          <div className="mb-4 text-sm text-text-secondary">{description}</div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] rounded-control border border-border px-4 text-sm text-text transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[44px] rounded-control px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? "در حال اجرا…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}