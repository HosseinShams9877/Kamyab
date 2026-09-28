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

  // The employee panel is the manager pages with an owner-scoped filter (C-15):
  // each list lives under /employee/* so it does not collide with the manager
  // group's top-level routes. Every link is still permission-gated — an employee
  // whose defaults were trimmed does not see a section they cannot open. Detail
  // pages are the shared /cases/[id] and /customers/[id], which guard by
  // ownership, so no per-item route is duplicated here.
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