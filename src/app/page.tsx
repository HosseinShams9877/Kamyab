import { formatJalali, todayJalali, addMonths } from "@/lib/jalali";
import { formatToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/digits";

// Foundation page: proves RTL layout, the Vazirmatn font, the color palette, and
// the Jalali / Toman / Persian-digit utilities render correctly. It is a
// scaffold placeholder; real pages are built in later phases.
export default function Home() {
  const today = todayJalali();
  const inSixMonths = addMonths(today, 6);

  const badges = [
    { label: "موفق", cls: "bg-success-bg text-success" },
    { label: "خطا", cls: "bg-error-bg text-error" },
    { label: "هشدار", cls: "bg-warning-bg text-warning" },
    { label: "اطلاع", cls: "bg-info-bg text-info" },
    { label: "غیرفعال", cls: "bg-disabled-bg text-disabled" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="mb-1 text-sm text-text-secondary">موسسه حقوقی ثبت کامیاب</p>
        <h1 className="text-2xl font-bold text-text">سامانه مدیریت عملیات</h1>
      </header>

      <section className="mb-6 rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-primary">پایه فنی آماده است</h2>
        <p className="mb-4 leading-7 text-text">
          این صفحه فقط برای بررسی زیرساخت است: چیدمان راست‌به‌چپ، فونت وزیرمتن،
          پالت رنگ، و ابزارهای تاریخ شمسی و مبلغ.
        </p>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-control bg-primary-light/60 p-4">
            <dt className="mb-1 text-sm text-text-secondary">تاریخ امروز</dt>
            <dd className="text-lg font-bold text-text">
              {formatJalali(today)}
            </dd>
          </div>
          <div className="rounded-control bg-primary-light/60 p-4">
            <dt className="mb-1 text-sm text-text-secondary">شش ماه بعد</dt>
            <dd className="text-lg font-bold text-text">
              {formatJalali(inSixMonths)}
            </dd>
          </div>
          <div className="rounded-control bg-primary-light/60 p-4">
            <dt className="mb-1 text-sm text-text-secondary">نمونه مبلغ</dt>
            <dd className="text-lg font-bold text-text">
              {formatToman(2_500_000)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 text-base font-bold text-text">وضعیت‌ها</h3>
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b.label}
              className={`rounded-badge px-3 py-1 text-sm font-medium ${b.cls}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 text-base font-bold text-text">دکمه‌ها</h3>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
            دکمه اصلی
          </button>
          <button className="rounded-control border border-border bg-card px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-page">
            دکمه ثانویه
          </button>
          <button
            disabled
            className="rounded-control bg-disabled-bg px-4 py-2 text-sm font-medium text-disabled"
          >
            غیرفعال
          </button>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          شماره نمونه: {toPersianDigits("PR-1405-0284")}
        </p>
      </section>
    </main>
  );
}
