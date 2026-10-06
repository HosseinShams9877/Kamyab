import type { PermissionKey } from "@/modules/permissions/permissions.guard";
import type { Role } from "@/types/enums";

// Persian presentation labels for the C-12 permission matrix and roles. Pure
// data (no JSX), so it lives in the employees module's lib/ folder and is
// consumed by that module's components (relative import) and re-exported for
// pages through the module barrel. It is client-safe: only `import type` from
// the isomorphic guard leaf, erased at build, so no server code is pulled into
// the client bundle.

export const ROLE_LABELS: Record<Role, string> = {
  MANAGER: "مدیر",
  SUPERVISOR: "سرپرست",
  EMPLOYEE: "کارمند",
};

export type PermissionGroup = {
  title: string;
  items: { key: PermissionKey; label: string }[];
};

// Order and grouping follow the C-12 matrix in docs/knowledge/05-pages-fields.md.
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "مشتریان",
    items: [
      { key: "customers.view", label: "مشاهده" },
      { key: "customers.create", label: "ایجاد" },
      { key: "customers.edit", label: "ویرایش" },
      { key: "customers.deactivate", label: "غیرفعال‌سازی" },
    ],
  },
  {
    title: "پرونده‌ها",
    items: [
      { key: "cases.view_all", label: "مشاهده همه" },
      { key: "cases.view_own", label: "مشاهده پرونده‌های خود" },
      { key: "cases.create", label: "ایجاد" },
      { key: "cases.edit", label: "ویرایش" },
      { key: "cases.assign_owner", label: "تعیین مالک" },
      { key: "cases.cancel", label: "لغو" },
      { key: "cases.restore", label: "بازگردانی" },
    ],
  },
  {
    title: "مراحل",
    items: [
      { key: "stages.advance", label: "پیشبرد مرحله" },
      { key: "stages.add_exceptional", label: "افزودن مرحلهٔ استثنایی" },
    ],
  },
  {
    title: "مالی",
    items: [
      { key: "financial.view", label: "مشاهدهٔ اطلاعات مالی" },
      { key: "financial.record_payment", label: "ثبت و حذف رسید" },
      { key: "financial.adjust_total", label: "تغییر مبلغ کل" },
    ],
  },
  {
    title: "وظایف",
    items: [
      { key: "tasks.view_all", label: "مشاهده همه" },
      { key: "tasks.view_own", label: "مشاهده وظایف خود" },
      { key: "tasks.create", label: "ایجاد" },
      { key: "tasks.assign", label: "تخصیص به دیگران" },
      { key: "tasks.record_result", label: "ثبت نتیجه" },
      { key: "tasks.archive", label: "بایگانی" },
      { key: "tasks.delete", label: "حذف" },
    ],
  },
  {
    title: "تمدیدها",
    items: [
      { key: "renewals.view", label: "مشاهده" },
      { key: "renewals.record_followup", label: "ثبت پیگیری" },
      { key: "renewals.register", label: "ثبت تمدید" },
      { key: "renewals.restore", label: "بازگردانی از رهاشده" },
    ],
  },
  {
    title: "کمپین‌ها",
    items: [
      { key: "campaigns.view", label: "مشاهدهٔ کمپین‌ها" },
      { key: "campaigns.create", label: "ایجاد کمپین" },
      { key: "campaigns.edit", label: "ویرایش کمپین" },
      { key: "campaigns.send", label: "ارسال کمپین" },
      { key: "campaigns.cancel", label: "لغو کمپین" },
    ],
  },
  {
    title: "خدمات",
    items: [
      { key: "services.view", label: "مشاهده" },
      { key: "services.edit", label: "ویرایش" },
    ],
  },
  {
    title: "کارکنان",
    items: [
      { key: "employees.view", label: "مشاهده" },
      { key: "employees.create", label: "ایجاد" },
      { key: "employees.edit", label: "ویرایش" },
      { key: "employees.change_permissions", label: "تغییر دسترسی‌ها" },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      { key: "settings.view", label: "مشاهده" },
      { key: "settings.edit", label: "ویرایش" },
    ],
  },
  {
    title: "گزارش‌ها",
    items: [{ key: "reports.view", label: "مشاهده" }],
  },
];