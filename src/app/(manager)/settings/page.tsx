import Link from "next/link";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can, ROLE_DEFAULTS } from "@/modules/permissions";
import {
  LIST_KINDS,
  listListItems,
  getInstituteInfo,
  getThresholds,
  getBirthday,
  getGateway,
  listTemplates,
  getSmsStatus,
  ListSection,
  InstituteInfoForm,
  ThresholdsForm,
  BirthdayForm,
  SmsTemplatesForm,
  SmsGatewayForm,
  SmsStatusPanel,
} from "@/modules/settings";
import { PERMISSION_GROUPS } from "@/modules/employees/lib/permission-labels";

// Settings page (C-13, section B) — tabbed. Each tab loads only its own
// sections (read via the URL search param), so the user never scrolls through
// unrelated settings. The "permissions" tab shows a read-only table of the
// three base roles' default permissions (the per-employee overrides live on
// the employee pages).
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string }>;

type TabKey =
  | "company"
  | "sms"
  | "sms-templates"
  | "notifications"
  | "general"
  | "permissions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "company", label: "اطلاعات شرکت" },
  { key: "sms", label: "تنظیمات پیامک" },
  { key: "sms-templates", label: "قالب پیامک‌ها" },
  { key: "notifications", label: "اعلان‌ها" },
  { key: "general", label: "عمومی" },
  { key: "permissions", label: "مدیریت دسترسی‌ها" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-card">
      <h2 className="mb-4 text-lg font-bold text-text">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "settings.view")) redirect("/dashboard");

  const canEdit = can(user, "settings.edit");
  const sp = await searchParams;
  const tab: TabKey = (TABS.map((t) => t.key) as string[]).includes(sp.tab ?? "")
    ? (sp.tab as TabKey)
    : "company";

  return (
    <main className="mx-auto w-full px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">تنظیمات</h1>
        <p className="mt-1 text-sm text-text-secondary">
          پیکربندی شرکت، پیامک، اعلان‌ها و دسترسی‌ها
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="mb-6 flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/settings?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {tab === "company" && (
          <Section title="اطلاعات موسسه">
            <InstituteInfoForm info={await getInstituteInfo()} canEdit={canEdit} />
          </Section>
        )}

        {tab === "sms" && (
          <>
            <Section title="سامانه پیامک">
              <SmsGatewayForm gateway={await getGateway()} canEdit={canEdit} />
            </Section>
            <Section title="وضعیت پیامک‌ها">
              <SmsStatusPanel status={await getSmsStatus()} />
            </Section>
          </>
        )}

        {tab === "sms-templates" && (
          <Section title="قالب‌های پیامک">
            <SmsTemplatesForm templates={await listTemplates()} canEdit={canEdit} />
          </Section>
        )}

        {tab === "notifications" && (
          <>
            <Section title="آستانه‌های زمانی">
              <ThresholdsForm thresholds={await getThresholds()} canEdit={canEdit} />
            </Section>
            <Section title="تبریک تولد">
              <BirthdayForm birthday={await getBirthday()} canEdit={canEdit} />
            </Section>
          </>
        )}

        {tab === "general" && (
          <>
            {(
              await Promise.all(
                LIST_KINDS.map(async (kind) => ({
                  kind,
                  items: await listListItems(kind),
                })),
              )
            ).map(({ kind, items }) => (
              <ListSection key={kind} kind={kind} items={items} canEdit={canEdit} />
            ))}
          </>
        )}

        {tab === "permissions" && (
          <>
            <Section title="دسترسی‌های پیش‌فرض هر نقش">
              <p className="mb-4 text-sm text-text-secondary">
                این جدول پیش‌فرض هر نقش را نشان می‌دهد. هنگام ساخت یا ویرایش هر
                کارمند، این دسترسی‌ها قابل تغییر هستند (فقط تفاوت‌ها ذخیره می‌شود).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <thead className="bg-page text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">دسترسی</th>
                      <th className="px-4 py-3 text-center font-medium">مدیر</th>
                      <th className="px-4 py-3 text-center font-medium">سرپرست</th>
                      <th className="px-4 py-3 text-center font-medium">کارمند</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_GROUPS.map((group) => (
                      <Fragment key={group.title}>
                        <tr className="bg-page/60">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-xs font-bold text-text"
                          >
                            {group.title}
                          </td>
                        </tr>
                        {group.items.map((item) => (
                          <tr key={item.key} className="border-t border-border">
                            <td className="px-4 py-2.5 text-text">{item.label}</td>
                            <td className="px-4 py-2.5 text-center">
                              {ROLE_DEFAULTS.MANAGER[item.key] ? "✅" : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {ROLE_DEFAULTS.SUPERVISOR[item.key] ? "✅" : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {ROLE_DEFAULTS.EMPLOYEE[item.key] ? "✅" : "—"}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="مدیریت کارمندان">
              <p className="mb-4 text-sm text-text-secondary">
                برای ساخت کارمند، ویرایش دسترسی‌های فردی، یا غیرفعال‌سازی، به صفحهٔ
                کارمندان بروید.
              </p>
              <Link
                href="/employees"
                className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                رفتن به کارمندان و دسترسی‌ها
              </Link>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}