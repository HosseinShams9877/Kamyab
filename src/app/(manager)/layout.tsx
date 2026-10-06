import { redirect } from "next/navigation";
import { requireUser, LogoutButton } from "@/modules/auth";
import { can } from "@/modules/permissions";
import { ROLE_LABELS } from "@/modules/employees";
import { SearchBox } from "@/modules/search";
import { NotificationBell, countMyUnread } from "@/modules/notifications";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

// Shared layout for the manager + supervisor route group. It authenticates the
// request, routes an employee to their own panel, and builds the sidebar link
// list — each entry gated by the server-side permission guard so a user never
// sees a link to a section they cannot open (the pages enforce the same checks;
// this only controls visibility). The presentational shell is rendered around
// every manager page.
export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");

  // Cases and tasks use the view_all / view_own split — the section is visible
  // if the user can see either scope.
  const navItems: NavItem[] = [
    { href: "/dashboard", label: "داشبورد" },
    can(user, "customers.view") && { href: "/customers", label: "مشتریان" },
    (can(user, "cases.view_all") || can(user, "cases.view_own")) && {
      href: "/cases",
      label: "پرونده‌ها",
    },
    (can(user, "tasks.view_all") || can(user, "tasks.view_own")) && {
      href: "/tasks",
      label: "پیگیری ها و کارها",
    },
    can(user, "renewals.view") && { href: "/renewals", label: "تمدیدها" },
    can(user, "services.view") && { href: "/services", label: "خدمات" },
    can(user, "employees.view") && { href: "/employees", label: "کارمندان" },
    can(user, "campaigns.view") && { href: "/campaigns", label: "کمپین‌ها" },
    can(user, "settings.view") && { href: "/settings", label: "تنظیمات" },
    can(user, "settings.view") && { href: "/engine", label: "موتور خودکار" },
    can(user, "reports.view") && { href: "/reports", label: "گزارش‌ها" },
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
          basePath="/notifications"
        />
      }
    >
      {children}
    </AppShell>
  );
}