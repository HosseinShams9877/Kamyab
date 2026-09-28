import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  getEmployeeDashboard,
  IndicatorCard,
  NearRenewalsTable,
  TodayTasksTable,
} from "@/modules/dashboard";

// Employee panel landing (C-15): the same computed metrics as the management
// dashboard, but owner-scoped to the acting user and WITHOUT the employee-status
// table (a workload report is a management-oversight view, never shown to the
// staff member themselves). Indicators and the "view all" links point into the
// owner-scoped /employee pages. Navigation, global search and logout live in the
// shared employee layout (the app shell).
export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/dashboard");

  const { indicators, nearRenewals, todaysTasks } =
    await getEmployeeDashboard(user);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">پنل کارمند</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {indicators.map((indicator) => (
          <IndicatorCard key={indicator.key} indicator={indicator} />
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <NearRenewalsTable rows={nearRenewals} allHref="/employee/renewals?tab=near" />
        <TodayTasksTable
          rows={todaysTasks}
          allHref="/employee/tasks?tab=today"
          showOwner={false}
        />
      </div>
    </main>
  );
}
