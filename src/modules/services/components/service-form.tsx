"use client";

import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
} from "@/modules/services/services.schema";
import type {
  CategoryOption,
  ServiceDetail,
  ReminderRuleRow,
} from "@/modules/services/services.types";
import type { PathStageRow, DurationRow } from "@/modules/paths/paths.types";
import { PathEditor } from "@/modules/paths/components/path-editor";
import { DurationsEditor } from "@/modules/paths/components/durations-editor";
import { ReminderRulesEditor } from "./reminder-rules-editor";

// Create / edit a service (B-1). URL-less tabs: the client component owns which
// section is visible (info / initial path / durations / renewal path / reminders)
// so the server page only has to pass the loaded data. The renewable toggle
// governs which tabs appear at all — non-renewable hides durations, renewal
// path and reminders.

type TabKey = "info" | "initial" | "durations" | "renewal" | "reminders";

const ALL_TABS: { key: TabKey; label: string; renewableOnly?: boolean }[] = [
  { key: "info", label: "اطلاعات" },
  { key: "initial", label: "مسیر ثبت اولیه" },
  { key: "durations", label: "مدت‌های اعتبار", renewableOnly: true },
  { key: "renewal", label: "مسیر تمدید", renewableOnly: true },
  { key: "reminders", label: "قواعد یادآوری", renewableOnly: true },
];

type Props =
  | { mode: "create"; categories: CategoryOption[] }
  | {
      mode: "edit";
      categories: CategoryOption[];
      service: ServiceDetail;
      initialStages?: PathStageRow[];
      renewalStages?: PathStageRow[];
      durations?: DurationRow[];
      reminderRules?: ReminderRuleRow[];
      canEdit?: boolean;
    };

type FormValues = {
  name: string;
  categoryId: string;
  description: string;
  renewable: boolean;
  status: boolean;
};

const inputClass =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-text outline-none transition-colors focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium text-text";
const errorClass = "mt-1.5 text-sm text-error";

export function ServiceForm(props: Props) {
  const { mode, categories } = props;
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState<TabKey>("info");

  const schema = mode === "create" ? serviceCreateSchema : serviceUpdateSchema;
  const initial = mode === "edit" ? props.service : undefined;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: initial?.name ?? "",
      categoryId: initial?.categoryId ?? "",
      description: initial?.description ?? "",
      renewable: initial?.renewable ?? false,
      status: initial?.status ?? true,
    },
  });

  const renewable = watch("renewable");
  const isEdit = mode === "edit";
  const serviceId = isEdit ? props.service!.id : "";
  const canEdit = isEdit ? props.canEdit ?? true : false;

  // If the renewable toggle turns off, drop the user back to a valid tab.
  useEffect(() => {
    if (!renewable && (tab === "durations" || tab === "renewal" || tab === "reminders")) {
      setTab("info");
    }
  }, [renewable, tab]);

  const visibleTabs = ALL_TABS.filter((t) => !t.renewableOnly || renewable);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setDone(false);
    const url =
      mode === "create" ? "/api/services" : `/api/services/${props.service!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as {
        ok: boolean;
        field?: string;
        message?: string;
        id?: string;
      };
      if (res.ok && data.ok) {
        setDone(true);
        if (mode === "create" && data.id) {
          router.push(`/services/${data.id}`);
          return;
        }
        router.refresh();
        return;
      }
      if (data.field === "name" || data.field === "categoryId") {
        setError(data.field, { message: data.message });
      } else {
        setFormError(data.message ?? "خطایی رخ داد. دوباره تلاش کنید.");
      }
    } catch {
      setFormError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-t-card border border-b-0 border-border bg-card px-2 shadow-card"
      >
        {visibleTabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Info tab — the form itself */}
      {tab === "info" && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-card border border-border bg-card p-6 shadow-card"
          noValidate
        >
          {formError && (
            <div role="alert" className="rounded-control bg-error-bg px-4 py-3 text-sm text-error">
              {formError}
            </div>
          )}
          {done && mode === "edit" && (
            <div className="rounded-control bg-page px-4 py-3 text-sm text-primary">
              تغییرات ذخیره شد.
            </div>
          )}

          <div>
            <label htmlFor="name" className={labelClass}>نام خدمت</label>
            <input id="name" type="text" dir="rtl" className={inputClass} {...register("name")} />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="categoryId" className={labelClass}>دسته‌بندی</label>
            <select id="categoryId" dir="rtl" className={inputClass} {...register("categoryId")}>
              <option value="">— انتخاب دسته‌بندی —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {errors.categoryId && <p className={errorClass}>{errors.categoryId.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>توضیحات (اختیاری)</label>
            <textarea
              id="description"
              rows={3}
              dir="rtl"
              className={inputClass}
              {...register("description")}
            />
            {errors.description && <p className={errorClass}>{errors.description.message}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" {...register("renewable")} />
            خدمت تمدیدشونده است (مدت اعتبار، مسیر تمدید و قواعد یادآوری دارد)
          </label>

          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" {...register("status")} />
            فعال
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled"
          >
            {isSubmitting ? "در حال ذخیره…" : mode === "create" ? "ایجاد خدمت" : "ذخیره تغییرات"}
          </button>
        </form>
      )}

      {/* Initial path tab */}
      {tab === "initial" && (
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          {isEdit ? (
            <PathEditor
              serviceId={serviceId}
              pathType="INITIAL"
              stages={props.initialStages ?? []}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-center text-sm text-text-secondary">
              بعد از ذخیرهٔ خدمت، مراحل این مسیر را تعریف کنید.
            </p>
          )}
        </div>
      )}

      {/* Durations tab */}
      {tab === "durations" && (
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          {isEdit ? (
            <DurationsEditor
              serviceId={serviceId}
              durations={props.durations ?? []}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-center text-sm text-text-secondary">
              بعد از ذخیرهٔ خدمت، مدت‌های اعتبار را تعریف کنید.
            </p>
          )}
        </div>
      )}

      {/* Renewal path tab */}
      {tab === "renewal" && (
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          {isEdit ? (
            <PathEditor
              serviceId={serviceId}
              pathType="RENEWAL"
              stages={props.renewalStages ?? []}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-center text-sm text-text-secondary">
              بعد از ذخیرهٔ خدمت، مراحل تمدید را تعریف کنید.
            </p>
          )}
        </div>
      )}

      {/* Reminders tab */}
      {tab === "reminders" && (
        <div className="space-y-6">
          {isEdit ? (
            <>
              <div className="rounded-card border border-border bg-card p-6 shadow-card">
                <ReminderRulesEditor
                  serviceId={serviceId}
                  channel="INTERNAL_NOTIFICATION"
                  rules={props.reminderRules ?? []}
                  canEdit={canEdit}
                />
              </div>
              <div className="rounded-card border border-border bg-card p-6 shadow-card">
                <ReminderRulesEditor
                  serviceId={serviceId}
                  channel="SMS_TO_CUSTOMER"
                  rules={props.reminderRules ?? []}
                  canEdit={canEdit}
                />
              </div>
            </>
          ) : (
            <div className="rounded-card border border-border bg-card p-6 text-center shadow-card">
              <p className="text-sm text-text-secondary">
                بعد از ذخیرهٔ خدمت، قواعد یادآوری را تعریف کنید.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}