import type { SmsStatusView } from "../settings.types";
import { toPersianDigits } from "@/lib/digits";
import { toJalali, formatJalali } from "@/lib/jalali";
import { smsEventLabel } from "../lib/labels";

// SMS status view (C-13): counts by status + recent failures with error detail.
// Display-only server component (no interactivity, no client bundle).

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success-bg text-success"
      : tone === "error"
        ? "bg-error-bg text-error"
        : "bg-info-bg text-info";
  return (
    <div className={`flex-1 rounded-control px-4 py-3 text-center ${toneClass}`}>
      <div className="text-2xl font-bold">{toPersianDigits(String(value))}</div>
      <div className="mt-1 text-xs">{label}</div>
    </div>
  );
}

export function SmsStatusPanel({ status }: { status: SmsStatusView }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="ارسال‌شده" value={status.sent} tone="success" />
        <Stat label="در صف" value={status.queued} tone="info" />
        <Stat label="ناموفق" value={status.failed} tone="error" />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-text">آخرین خطاها</h3>
        {status.recentFailures.length === 0 ? (
          <p className="rounded-control bg-page px-4 py-4 text-center text-sm text-text-secondary">
            خطایی ثبت نشده است.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {status.recentFailures.map((f) => (
              <li key={f.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-text" dir="ltr">{f.recipient}</span>
                  <span className="text-xs text-text-secondary">
                    {smsEventLabel(f.templateKey)} •{" "}
                    {formatJalali(toJalali(f.createdAt))}
                  </span>
                </div>
                {f.error && (
                  <p className="mt-1 text-xs text-error">{f.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
