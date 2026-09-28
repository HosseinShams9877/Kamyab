"use client";

import { useState } from "react";
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
// Direct leaf imports (client-component exception) to avoid the barrels (they
// pull in server-only code).
import { PathEditor } from "@/modules/paths/components/path-editor";
import { DurationsEditor } from "@/modules/paths/components/durations-editor";
import { ReminderRulesEditor } from "./reminder-rules-editor";

// Create / edit a service (B-1). The renewable toggle reveals the renewable-only
// sections live:
//   - renewable OFF: only the INITIAL path section
//   - renewable ON:  INITIAL path + durations + RENEWAL path + TWO reminder
//                    editors (internal notifications + customer SMS)
//
// In edit mode the sections are the real editors (the service exists, edits save
// live). In create mode the same section slots show read-only preview cards
// until the service is saved and the user is redirected to /services/<id>.

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

  const isEdit = mode === "edit";
  const serviceId = isEdit ? props.service!.id : "";
  const canEdit = isEdit ? props.canEdit ?? true : false;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <input id="name" type="text" className={inputClass} {...register("name")} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="categoryId" className={labelClass}>دسته‌بندی</label>
          <select id="categoryId" className={inputClass} {...register("categoryId")}>
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

      {/* INITIAL path — ALWAYS shown. */}
      {isEdit ? (
        <PathEditor
          serviceId={serviceId}
          pathType="INITIAL"
          stages={props.initialStages ?? []}
          canEdit={canEdit}
        />
      ) : (
        <div className="rounded-card border border-dashed border-border bg-page p-6 text-center text-sm text-text-secondary">
          مسیر ثبت اولیه
          <p className="mt-1 text-xs">بعد از ذخیره، مراحل این مسیر را تعریف کنید.</p>
        </div>
      )}

      {/* Renewable-only sections — only when the toggle is on. */}
      {renewable && (
        <div className="space-y-6">
          {/* Durations */}
          {isEdit ? (
            <DurationsEditor
              serviceId={serviceId}
              durations={props.durations ?? []}
              canEdit={canEdit}
            />
          ) : (
            <div className="rounded-card border border-dashed border-border bg-page p-6 text-center text-sm text-text-secondary">
              مدت‌های اعتبار
              <p className="mt-1 text-xs">بعد از ذخیره، مدت‌ها را تعریف کنید.</p>
            </div>
          )}

          {/* RENEWAL path */}
          {isEdit ? (
            <PathEditor
              serviceId={serviceId}
              pathType="RENEWAL"
              stages={props.renewalStages ?? []}
              canEdit={canEdit}
            />
          ) : (
            <div className="rounded-card border border-dashed border-border bg-page p-6 text-center text-sm text-text-secondary">
              مسیر تمدید
              <p className="mt-1 text-xs">بعد از ذخیره، مراحل تمدید را تعریف کنید.</p>
            </div>
          )}

          {/* Reminder rules — internal + SMS, two independent editors. */}
          {isEdit ? (
            <>
              <ReminderRulesEditor
                serviceId={serviceId}
                channel="INTERNAL_NOTIFICATION"
                rules={props.reminderRules ?? []}
                canEdit={canEdit}
              />
              <ReminderRulesEditor
                serviceId={serviceId}
                channel="SMS_TO_CUSTOMER"
                rules={props.reminderRules ?? []}
                canEdit={canEdit}
              />
            </>
          ) : (
            <>
              <div className="rounded-card border border-dashed border-border bg-page p-6 text-center text-sm text-text-secondary">
                یادآوری داخلی
                <p className="mt-1 text-xs">بعد از ذخیره، قواعد را تعریف کنید.</p>
              </div>
              <div className="rounded-card border border-dashed border-border bg-page p-6 text-center text-sm text-text-secondary">
                پیامک مشتری
                <p className="mt-1 text-xs">بعد از ذخیره، قواعد را تعریف کنید.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}