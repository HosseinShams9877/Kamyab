import { redirect } from "next/navigation";
import { requireUser, LogoutButton } from "@/modules/auth";

// Employee panel landing (C-15). Built out in Phase 16 as the manager pages with
// an owner-scoped filter; for Phase 3 it is a minimal protected page proving the
// session guard and role routing. A manager/supervisor landing here directly is
// routed to the management dashboard.
export default async function EmployeePage() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">پنل کارمند</h1>
        <LogoutButton />
      </div>
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <p className="text-text">
          خوش آمدید، <span className="font-bold">{user.fullName}</span>.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          محتوای پنل در فازهای بعدی ساخته می‌شود.
        </p>
      </div>
    </main>
  );
}
