import { toPersianDigits } from "@/lib/digits";
// Isomorphic leaf imports: never the followups barrel (server-only Prisma).
import type { FollowUpRow } from "../followups.types";
import { RENEWAL_EFFECT_LABELS } from "../lib/labels";

// The case-page follow-up timeline (C-11 / B-6): every follow-up recorded on the
// case, newest first, immutable. A presentational leaf — the server page loads the
// rows and renders this as the Tasks-tab slot, so the client CaseTabs never imports
// the followups barrel. No domain logic here (rule 10): labels come from the
// isomorphic lib, dates arrive already formatted.

const badge = "rounded-badge px-2.5 py-0.5 text-xs";
const placeholder =
  "rounded-card border border-border bg-card p-8 text-center text-sm text-text-secondary shadow-card";

export function FollowUpTimeline({ followUps }: { followUps: FollowUpRow[] }) {
  if (followUps.length === 0) {
    return <div className={placeholder}>هنوز پیگیری‌ای برای این پرونده ثبت نشده است.</div>;
  }
  return (
    <ul className="space-y-2">
      {followUps.map((f) => (
        <li key={f.id} className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{f.resultTitle}</span>
            <span className="text-xs text-text-secondary" dir="ltr">
              {toPersianDigits(f.createdAt)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {f.effectOnRenewal !== "NONE" && (
              <span className={`${badge} bg-info-bg text-info`}>
                {RENEWAL_EFFECT_LABELS[f.effectOnRenewal]}
              </span>
            )}
            {f.taskTitle && (
              <span className="text-xs text-text-secondary">کار: {f.taskTitle}</span>
            )}
          </div>
          {f.note && (
            <p className="mt-2 rounded-control bg-page px-3 py-2 text-xs text-text">{f.note}</p>
          )}
          <p className="mt-2 text-xs text-text-secondary">ثبت‌کننده: {f.createdByName}</p>
        </li>
      ))}
    </ul>
  );
}
