"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Minimal logout control: clears the session cookie via the API, then returns to
// the login page. Placed on the Phase 3 landing pages so the auth flow is
// testable end to end.
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      className="rounded-control border border-border bg-card px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-page disabled:text-disabled"
    >
      {busy ? "در حال خروج…" : "خروج"}
    </button>
  );
}
