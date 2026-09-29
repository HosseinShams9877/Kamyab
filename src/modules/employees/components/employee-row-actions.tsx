"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Row actions for the employees list (C-12): open the profile editor or the
// permission matrix; quick activate/deactivate. The `basePath` prop decides
// whether links resolve against /employees (manager shell) or /employee/employees
// (employee shell).

type Props = {
  id: string;
  status: boolean;
  canEdit: boolean;
  basePath?: string;
};

const btn =
  "inline-flex min-h-[32px] items-center rounded-control border border-border px-3 text-xs text-text hover:bg-page disabled:opacity-50";

export function EmployeeRowActions({
  id,
  status,
  canEdit,
  basePath = "/employees",
}: Props) {
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
      <Link href={`${basePath}/${id}`} className={btn}>
        ویرایش
      </Link>
      <Link href={`${basePath}/${id}?tab=permissions`} className={btn}>
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