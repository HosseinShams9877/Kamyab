import { redirect } from "next/navigation";
import { requireUser, LogoutButton } from "@/modules/auth";
import { ROLE_LABELS } from "@/modules/employees";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

// Shared layout for the employee route group (C-15). Same shell as the manager
// group but with a simpler, owner-scoped sidebar. A manager/supervisor landing
// here is routed to the management dashboard.
export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/dashboard");

  // Only the dashboard route exists in this group today. Phase 16 builds the
  // employee panel as the manager pages with an owner-scoped filter (my-cases,
  // tasks, renewals); their links are added here then. We deliberately do not
  // link routes that do not exist yet (they would 404).
  const navItems: NavItem[] = [{ href: "/employee", label: "داشبورد" }];

  return (
    <AppShell
      navItems={navItems}
      userName={user.fullName}
      roleLabel={ROLE_LABELS[user.role]}
      logout={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}
