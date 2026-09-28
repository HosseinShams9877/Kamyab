"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Row actions for the employees list (C-12): open the profile editor or the
// permission matrix; quick activate/deactivate.

type Props = {
  id: string;
  status: boolean;
  canEdit: boolean;
};

const btn =
  "inline-flex min-h-[32px] items-center rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:opacity-50";

export function EmployeeRowActions({ id, status, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const url = status
        ? `/api/employees/${id}/deactivate`
        : `/api/employees/${id}/reactivate`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={`/employees/${id}`} className={btn}>
        ویرایش
      </Link>
      <Link href={`/employees/${id}?tab=permissions`} className={btn}>
        دسترسی‌ها
      </Link>
      {canEdit && (
        <button type="button" onClick={toggle} disabled={busy} className={btn}>
          {status ? "غیرفعال‌سازی" : "فعال‌سازی"}
        </button>
      )}
    </div>
  );
}