"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CampaignFormData } from "../campaigns.types";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { PersianTextarea } from "@/components/ui/persian-textarea";
import { smsEventLabel } from "@/modules/settings/lib/labels";

// The campaign creation form. Only campaign-scoped SMS templates are offered
// (event keys starting with "campaign_"); system templates such as
// renewal_reminder and birthday_* are NOT shown here.
//
// `basePath` chooses the detail-route prefix after a successful save:
//   managers → "/campaigns"
//   employees → "/employee/campaigns"

const field =
  "min-h-[44px] w-full rounded-control border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-secondary outline-none transition-colors focus:border-primary disabled:opacity-50";
const label = "mb-2 block text-sm font-medium text-text";
const primaryBtn =
  "min-h-[44px] rounded-control bg-primary px-4 text-sm text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

type Channel = "SMS" | "INTERNAL_NOTIFICATION";

export function CampaignForm({
  data,
  basePath = "/campaigns",
}: {
  data: CampaignFormData;
  basePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only campaign-scoped templates are shown in the picker.
  const campaignTemplates = data.templates.filter((t) =>
    t.eventKey.startsWith("campaign_"),
  );

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("SMS");
  const [templateKey, setTemplateKey] = useState(
    campaignTemplates[0]?.eventKey ?? "",
  );
  const [body, setBody] = useState(campaignTemplates[0]?.body ?? "");
  const [scheduledAt, setScheduledAt] = useState("");

  // Audience
  const [customerType, setCustomerType] = useState<"" | "NATURAL" | "LEGAL">("");
  const [city, setCity] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [hasActiveCase, setHasActiveCase] = useState(false);
  const [hasBalance, setHasBalance] = useState(false);
  const [joinedAfter, setJoinedAfter] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");

  const working = busy || pending;

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function pickTemplate(eventKey: string) {
    setTemplateKey(eventKey);
    const t = campaignTemplates.find((x) => x.eventKey === eventKey);
    if (t) setBody(t.body);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          templateKey: channel === "SMS" ? templateKey : "",
          body,
          scheduledAt,
          audienceFilter: {
            customerType: customerType || null,
            city: city || null,
            serviceIds,
            hasActiveCase: hasActiveCase || null,
            hasBalance: hasBalance || null,
            joinedAfter: joinedAfter || null,
            birthdayMonth: birthdayMonth ? Number(birthdayMonth) : null,
          },
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        id?: string;
        field?: string;
        message?: string;
      };
      if (res.ok && d.ok && d.id) {
        startTransition(() => {
          router.push(`${basePath}/${d.id}`);
          router.refresh();
        });
        return;
      }
      setError(d.message ?? "ثبت کمپین انجام نشد.");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {/* Basic */}
      <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 className="text-base font-bold text-text">اطلاعات کمپین</h2>
        <div>
          <label className={label}>نام کمپین</label>
          <input
            type="text"
            dir="rtl"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={working}
            className={field}
          />
        </div>

        <div>
          <label className={label}>کانال ارسال</label>
          <select
            dir="rtl"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            disabled={working}
            className={field}
          >
            <option value="SMS">پیامک</option>
            <option value="INTERNAL_NOTIFICATION">اعلان داخلی</option>
          </select>
        </div>

        {channel === "SMS" && (
          <div>
            <label className={label}>قالب پیامک</label>
            <select
              dir="rtl"
              value={templateKey}
              onChange={(e) => pickTemplate(e.target.value)}
              disabled={working}
              className={field}
            >
              <option value="">— انتخاب قالب —</option>
              {campaignTemplates.map((t) => (
                <option key={t.eventKey} value={t.eventKey}>
                  {smsEventLabel(t.eventKey)}
                </option>
              ))}
            </select>
            {campaignTemplates.length === 0 && (
              <p className="mt-1 text-xs text-text-secondary">
                هنوز قالب کمپینی تعریف نشده. از بخش تنظیمات ← قالب پیامک‌ها
                اضافه کنید.
              </p>
            )}
          </div>
        )}

        <div>
          <label className={label}>متن پیام</label>
          <PersianTextarea
            rows={4}
            value={body}
            onChange={setBody}
            disabled={working}
            dir="rtl"
            className={`${field} min-h-[120px] resize-none`}
          />
        </div>

        <div >
          <label className={label}>زمان‌بندی (اختیاری — خالی = فوری)</label>
          <JalaliDatePicker
            value={scheduledAt}
            onChange={setScheduledAt}
            placeholder="۱۴۰۵/۰۷/۰۱"
          />
        </div>
      </section>

      {/* Audience */}
      <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 className="text-base font-bold text-text">مخاطبان</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>نوع مشتری</label>
            <select
              dir="rtl"
              value={customerType}
              onChange={(e) =>
                setCustomerType(e.target.value as "" | "NATURAL" | "LEGAL")
              }
              disabled={working}
              className={field}
            >
              <option value="">هر دو</option>
              <option value="NATURAL">حقیقی</option>
              <option value="LEGAL">حقوقی</option>
            </select>
          </div>
          <div>
            <label className={label}>شهر</label>
            <input
              type="text"
              dir="rtl"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={working}
              className={field}
            />
          </div>
        </div>

        <div>
          <label className={label}>خدمات (چند انتخابی)</label>
          <div className="flex flex-wrap gap-2">
            {data.services.map((s) => {
              const on = serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  disabled={working}
                  className={`rounded-control border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:bg-page"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
            {data.services.length === 0 && (
              <p className="text-xs text-text-secondary">خدمتی ثبت نشده.</p>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={hasActiveCase}
            onChange={(e) => setHasActiveCase(e.target.checked)}
            disabled={working}
          />
          فقط مشتری‌های دارای پروندهٔ فعال
        </label>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={hasBalance}
            onChange={(e) => setHasBalance(e.target.checked)}
            disabled={working}
          />
          فقط مشتری‌های دارای مانده
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>عضو از تاریخ (اختیاری)</label>
            <JalaliDatePicker
              value={joinedAfter}
              onChange={setJoinedAfter}
              placeholder="۱۴۰۰/۰۱/۰۱"
            />
          </div>
          <div>
            <label className={label}>ماه تولد (اختیاری)</label>
            <select
              dir="rtl"
              value={birthdayMonth}
              onChange={(e) => setBirthdayMonth(e.target.value)}
              disabled={working}
              className={field}
            >
              <option value="">هر ماه</option>
              <option value="1">فروردین</option>
              <option value="2">اردیبهشت</option>
              <option value="3">خرداد</option>
              <option value="4">تیر</option>
              <option value="5">مرداد</option>
              <option value="6">شهریور</option>
              <option value="7">مهر</option>
              <option value="8">آبان</option>
              <option value="9">آذر</option>
              <option value="10">دی</option>
              <option value="11">بهمن</option>
              <option value="12">اسفند</option>
            </select>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={working || !name.trim() || !body.trim()}
        className={primaryBtn}
      >
        {working ? "در حال ثبت…" : "ثبت کمپین"}
      </button>
    </div>
  );
}