import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth";
import { can } from "@/modules/permissions";
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

// Settings page (C-13, section B). One sectioned page — each section is
// independent and saves immediately. Server component: authorizes, reads all
// settings through the module service, and renders. `settings.edit` gates
// mutation UI, but the API routes re-check it regardless (rule 3).

export const dynamic = "force-dynamic";

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

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (!can(user, "settings.view")) redirect("/dashboard");

  const canEdit = can(user, "settings.edit");

  const [
    departments,
    categories,
    paymentMethods,
    cancellationReasons,
    followUpResults,
    info,
    thresholds,
    birthday,
    gateway,
    templates,
    smsStatus,
  ] = await Promise.all([
    listListItems("departments"),
    listListItems("categories"),
    listListItems("paymentMethods"),
    listListItems("cancellationReasons"),
    listListItems("followUpResults"),
    getInstituteInfo(),
    getThresholds(),
    getBirthday(),
    getGateway(),
    listTemplates(),
    getSmsStatus(),
  ]);

  const listData = {
    departments,
    categories,
    paymentMethods,
    cancellationReasons,
    followUpResults,
  } as const;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-text">تنظیمات</h1>

      <Section title="اطلاعات موسسه">
        <InstituteInfoForm info={info} canEdit={canEdit} />
      </Section>

      {LIST_KINDS.map((kind) => (
        <ListSection
          key={kind}
          kind={kind}
          items={listData[kind]}
          canEdit={canEdit}
        />
      ))}

      <Section title="آستانه‌های زمانی">
        <ThresholdsForm thresholds={thresholds} canEdit={canEdit} />
      </Section>

      <Section title="تبریک تولد">
        <BirthdayForm birthday={birthday} canEdit={canEdit} />
      </Section>

      <Section title="قالب‌های پیامک">
        <SmsTemplatesForm templates={templates} canEdit={canEdit} />
      </Section>

      <Section title="سامانه پیامک">
        <SmsGatewayForm gateway={gateway} canEdit={canEdit} />
      </Section>

      <Section title="وضعیت پیامک‌ها">
        <SmsStatusPanel status={smsStatus} />
      </Section>
    </main>
  );
}
