import Link from "next/link";
import type { DashboardIndicator } from "../dashboard.types";

// A single dashboard indicator (C-2): a computed headline number that links to
// the filtered list explaining it. Server component — purely presentational,
// fed an already-formatted value + href by the dashboard service.

const VALUE_TONE: Record<DashboardIndicator["tone"], string> = {
  default: "text-text",
  warning: "text-warning",
  danger: "text-error",
};

export function IndicatorCard({ indicator }: { indicator: DashboardIndicator }) {
  return (
    <Link
      href={indicator.href}
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-5 shadow-card transition-colors hover:border-primary"
    >
      <span className="text-sm text-text-secondary">{indicator.label}</span>
      <span className={`text-2xl font-bold ${VALUE_TONE[indicator.tone]}`}>
        {indicator.value}
      </span>
    </Link>
  );
}
