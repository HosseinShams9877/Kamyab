// Idempotent seed: default manager-defined lists, baseline settings, default SMS
// templates, and one bootstrap manager account. Safe to run repeatedly — every
// write is an upsert keyed by a unique field, so re-running changes nothing.
//
// Run with:  npm run db:dev:seed        (after npm run db:dev:push)
// or:        npx prisma db seed
//
// User-facing DATA (list titles, template bodies, institute name) is Persian by
// policy; all identifiers and comments stay English.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load .env so DATABASE_URL is available when run directly via tsx (the Prisma
// CLI loads it for `prisma db seed`, but a direct run needs this).
try {
  process.loadEnvFile();
} catch {
  // .env may be absent in some environments; process.env is used as-is.
}

const prisma = new PrismaClient();

// Ordered lookup lists. `order` is assigned from array position.
const departments = ["ثبت شرکت‌ها", "برند و علائم تجاری", "مالی", "پیگیری"];

const serviceCategories = [
  "ثبت شرکت",
  "برند و علائم تجاری",
  "خدمات اداری",
  "سایر",
];

const paymentMethods = ["نقدی", "کارت به کارت", "انتقال بانکی", "چک"];

const cancellationReasons = [
  "انصراف مشتری",
  "عدم پرداخت",
  "پرونده تکراری",
  "سایر",
];

// effectOnRenewal must be a RenewalEffect value (NONE | AGREES_TO_RENEW | NOT_INTERESTED).
const followUpResults: { title: string; effectOnRenewal: string }[] = [
  { title: "تماس گرفته شد", effectOnRenewal: "NONE" },
  { title: "مشتری پاسخ نداد", effectOnRenewal: "NONE" },
  { title: "منتظر پاسخ مشتری", effectOnRenewal: "NONE" },
  { title: "موافق تمدید", effectOnRenewal: "AGREES_TO_RENEW" },
  { title: "منصرف از تمدید", effectOnRenewal: "NOT_INTERESTED" },
];

// Baseline settings. Values are JSON-serialized so numbers/booleans round-trip
// through the String `value` column. Thresholds follow B-8; timezone follows the
// owner's ruling (Asia/Tehran). The SMS real-send switch defaults OFF for safety.
//
// Stage-due reminders (تب تنظیمات مراحل): the whole feature is OFF by default,
// the notification-only channel is the default, and the case-owner is the default
// recipient. Managers turn it on and customise channels / recipients / templates
// from the case page's settings tab.
const settings: Record<string, unknown> = {
  institute_name: "موسسه حقوقی ثبت کامیاب",
  institute_phone: "",
  institute_address: "",
  institute_email: "",
  timezone: "Asia/Tehran",
  threshold_archive_days: 7,
  threshold_abandonment_days: 30,
  threshold_stale_days: 10,
  birthday_greeting_enabled: false, // B-9: master switch defaults OFF
  birthday_send_hour: 10, // B-9: default send hour
  sms_provider: "",
  sms_api_key: "", // secret; never echoed back to the client after saving (B-10)
  sms_sender_number: "",
  sms_real_send: false, // real sending stays off until the manager enables it
  // Stage-due reminders (تب تنظیمات مراحل)
  stage_reminder_enabled: false,
  stage_reminder_days: 3,
  stage_reminder_channels: ["INTERNAL_NOTIFICATION"],
  stage_reminder_recipients: ["CASE_OWNER"],
  stage_auto_prompt: false,
  stage_notification_template:
    "یادآوری سررسید مرحله: «{stageTitle}» پروندهٔ {caseNumber} — {daysRemaining} روز مانده. {instituteName}",
  stage_sms_template:
    "{customerName} عزیز، سررسید مرحلهٔ «{stageTitle}» پروندهٔ {caseNumber} تا {daysRemaining} روز دیگر است. {instituteName}",
};

// Default SMS templates ({placeholders} are filled by the engine).
const smsTemplates: { eventKey: string; body: string }[] = [
  {
    eventKey: "renewal_reminder",
    body: "{customerName} عزیز، اعتبار خدمت «{serviceName}» در تاریخ {expiryDate} به پایان می‌رسد. جهت تمدید با ما تماس بگیرید. {instituteName}",
  },
  {
    eventKey: "birthday_natural",
    body: "{customerName} عزیز، زادروزتان مبارک. با آرزوی بهروزی. {instituteName}",
  },
  {
    eventKey: "birthday_legal",
    body: "{companyName} گرامی، سالروز تأسیس مجموعه‌تان را تبریک می‌گوییم. {instituteName}",
  },
  {
    eventKey: "campaign_general",
    body: "سلام {customerName}، {instituteName} در خدمت شماست.",
  },
  {
    eventKey: "stage_due_reminder",
    body: "{customerName} عزیز، سررسید مرحلهٔ «{stageTitle}» پروندهٔ {caseNumber} تا {daysRemaining} روز دیگر است. {instituteName}",
  },
];

async function seedLookup(
  label: string,
  titles: string[],
  upsertByTitle: (title: string, order: number) => Promise<unknown>,
) {
  for (let i = 0; i < titles.length; i++) {
    await upsertByTitle(titles[i], i);
  }
  console.log(`  ${label}: ${titles.length}`);
}

async function main() {
  console.log("Seeding…");

  await seedLookup("departments", departments, (title, order) =>
    prisma.department.upsert({
      where: { title },
      update: { order },
      create: { title, order },
    }),
  );

  await seedLookup("service categories", serviceCategories, (title, order) =>
    prisma.serviceCategory.upsert({
      where: { title },
      update: { order },
      create: { title, order },
    }),
  );

  await seedLookup("payment methods", paymentMethods, (title, order) =>
    prisma.paymentMethod.upsert({
      where: { title },
      update: { order },
      create: { title, order },
    }),
  );

  await seedLookup(
    "cancellation reasons",
    cancellationReasons,
    (title, order) =>
      prisma.cancellationReason.upsert({
        where: { title },
        update: { order },
        create: { title, order },
      }),
  );

  for (let i = 0; i < followUpResults.length; i++) {
    const r = followUpResults[i];
    await prisma.followUpResult.upsert({
      where: { title: r.title },
      update: { effectOnRenewal: r.effectOnRenewal, order: i },
      create: { title: r.title, effectOnRenewal: r.effectOnRenewal, order: i },
    });
  }
  console.log(`  follow-up results: ${followUpResults.length}`);

  for (const [key, value] of Object.entries(settings)) {
    const serialized = JSON.stringify(value);
    await prisma.setting.upsert({
      where: { key },
      // Do not overwrite a value the manager may have already changed.
      update: {},
      create: { key, value: serialized },
    });
  }
  console.log(`  settings: ${Object.keys(settings).length}`);

  for (const t of smsTemplates) {
    await prisma.smsTemplate.upsert({
      where: { eventKey: t.eventKey },
      update: {},
      create: { eventKey: t.eventKey, body: t.body },
    });
  }
  console.log(`  sms templates: ${smsTemplates.length}`);

  // Bootstrap manager. Credentials come from env with safe defaults; the hash is
  // only set on create so re-seeding never resets a rotated password.
  const mobile = process.env.BOOTSTRAP_MANAGER_MOBILE ?? "09120000000";
  const password = process.env.BOOTSTRAP_MANAGER_PASSWORD ?? "Admin@1404";
  const passwordHash = bcrypt.hashSync(password, 10);
  await prisma.employee.upsert({
    where: { mobile },
    update: { role: "MANAGER", status: true },
    create: {
      fullName: "مدیر سیستم",
      mobile,
      role: "MANAGER",
      passwordHash,
      status: true,
    },
  });
  console.log(`  bootstrap manager: ${mobile}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });