import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import {
  getManagerDashboard,
  IndicatorCard,
  NearRenewalsTable,
  TodayTasksTable,
  EmployeeWorkloadTable,
} from "@/modules/dashboard";

// Management dashboard (C-2). Seven live indicators over the whole practice,
// each linking to the filtered list that explains it, plus the near-renewals,
// today's-tasks and employee-workload tables. Every figure is computed at read
// time by the dashboard aggregator (rule 2) and scoped inside the seams it
// calls (rule 3). Navigation, global search and logout live in the shared
// manager layout (the app shell).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");

  const { indicators, nearRenewals, todaysTasks, workloads } =
    await getManagerDashboard(user);

  return (
    <main className="mx-auto w-full px-4 py-10">
       <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">
            سلام {user.fullName} 👋
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            وضعیت عملیات امروز شرکت در یک نگاه
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicators.map((indicator) => (
          <IndicatorCard key={indicator.key} indicator={indicator} />
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <NearRenewalsTable rows={nearRenewals} />
        <TodayTasksTable rows={todaysTasks} />
        <EmployeeWorkloadTable rows={workloads} />
      </div>
    </main>
  );
}
