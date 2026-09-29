import { redirect } from "next/navigation";
import { requireUser, LogoutButton } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { ROLE_LABELS } from "@/modules/employees";
import { SearchBox } from "@/modules/search";
import { NotificationBell, countMyUnread } from "@/modules/notifications";
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

  // Each link is permission-gated — an employee whose defaults were trimmed
  // (or widened) sees exactly the sections they can open.
  const navItems: NavItem[] = [
    { href: "/employee", label: "داشبورد" },
    can(user, "customers.view") && { href: "/employee/customers", label: "مشتریان" },
    (can(user, "cases.view_all") || can(user, "cases.view_own")) && {
      href: "/employee/cases",
      label: "پرونده‌ها",
    },
    (can(user, "tasks.view_all") || can(user, "tasks.view_own")) && {
      href: "/employee/tasks",
      label: "کارها",
    },
    can(user, "renewals.view") && { href: "/employee/renewals", label: "تمدیدها" },
    can(user, "services.view") && { href: "/employee/services", label: "خدمات" },
    can(user, "employees.view") && { href: "/employee/employees", label: "کارمندان" },
    can(user, "reports.view") && { href: "/employee/reports", label: "گزارش‌ها" },
  ].filter(Boolean) as NavItem[];

  const unreadCount = await countMyUnread(user.id);

  return (
    <AppShell
      navItems={navItems}
      userName={user.fullName}
      roleLabel={ROLE_LABELS[user.role]}
      logout={<LogoutButton />}
      searchSlot={<SearchBox />}
      notificationBell={
        <NotificationBell
          initialUnread={unreadCount}
          basePath="/employee/notifications"
        />
      }
    >
      {children}
    </AppShell>
  );
}