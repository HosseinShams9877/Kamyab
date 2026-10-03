import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { getTaskFormData, TaskForm } from "@/modules/tasks";

// Standalone "new task" page (C-11). Server component: authorizes, loads the
// pick lists, then renders the client form. The API re-checks the same
// permission regardless (rule 3).
//
// ## The two optional query params
//
// `caseId` and `customerId` are how a case file's "+ کار جدید" button lands
// here with the case already picked. They are hints and not authority: the form
// starts from them, the user can change anything, and the API still re-checks
// the permission and the tenant scope. A request with neither — opening
// `/tasks/new` from the tasks list — starts the form empty, which is why they
// are `?` and not required.

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; customerId?: string }>;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "tasks.create")) redirect("/tasks");

  const sp = await searchParams;
  const formData = await getTaskFormData(user);

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <Link href="/tasks" className="text-sm text-primary hover:underline">
          ← بازگشت به کارها
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-text">ثبت کار جدید</h1>
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <TaskForm
          data={formData}
          defaultCaseId={sp.caseId}
          defaultCustomerId={sp.customerId}
        />
      </section>
    </main>
  );
}