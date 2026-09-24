"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PermissionMap } from "@/modules/permissions/permissions.guard";
import type { Role } from "@/types/enums";
import { PERMISSION_GROUPS, ROLE_LABELS } from "../lib/permission-labels";

// The C-12 permission matrix. For every permission it shows the role default and
// a per-permission toggle for the employee's effective value. Only the
// DIFFERENCES from the role default are stored (handled server-side); this
// component simply submits the full desired map.

type Props = {
  employeeId: string;
  role: Role;
  defaults: PermissionMap;
  effective: PermissionMap;
  canEdit: boolean;
};

export function PermissionMatrix({ employeeId, role, defaults, effective, canEdit }: Props) {
  const router = useRouter();
  const [desired, setDesired] = useState<Record<string, boolean>>({ ...effective });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(key: string) {
    setDesired((prev) => ({ ...prev, [key]: !prev[key] }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: desired }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "دسترسی‌ها ذخیره شد." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: "ذخیرهٔ دسترسی‌ها ناموفق بود." });
      }
    } catch {
      setMessage({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        نقش پایه: <span className="font-medium text-text">{ROLE_LABELS[role]}</span>. هر دسترسی
        به‌صورت پیش‌فرض از نقش می‌آید؛ فقط تفاوت‌ها ذخیره می‌شوند.
      </p>

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title} className="rounded-card border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-text">{group.title}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const value = desired[item.key] ?? false;
                const def = defaults[item.key] ?? false;
                const changed = value !== def;
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2"
                  >
                    <span className="text-sm text-text">
                      {item.label}
                      <span className="ms-2 text-xs text-text-secondary">
                        (پیش‌فرض: {def ? "مجاز" : "غیرمجاز"})
                      </span>
                      {changed && <span className="ms-1 text-xs text-primary">•</span>}
                    </span>
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={!canEdit}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? "text-primary" : "text-error"}`}>{message.text}</p>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
        >
          {saving ? "در حال ذخیره…" : "ذخیرهٔ دسترسی‌ها"}
        </button>
      )}
    </div>
  );
}
