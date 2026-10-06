import {
  findSetting,
  findSettings,
  saveSettings as saveSettingsRepo,
  listItems as repoListItems,
  nextOrder,
  createItem,
  updateItem,
  deleteItem,
  countUsage,
  moveItem,
  listSmsTemplates,
  findSmsTemplate,
  updateSmsTemplateBody,
  countSmsByStatus,
  listRecentFailures,
} from "./settings.repository";
import { instituteNameSchema } from "./settings.schema";
import type {
  SettingKey,
  ListKind,
  ListItem,
  InstituteInfo,
  Thresholds,
  BirthdaySettings,
  GatewayView,
  SmsTemplateRow,
  SmsStatusView,
} from "./settings.types";
import type {
  InstituteInfoInput,
  ThresholdsInput,
  BirthdayInput,
  SmsGatewayInput,
} from "./settings.schema";
import type { RenewalEffect } from "@/types/enums";
import { toPersianDigits } from "@/lib/digits";

// Settings service. Settings are stored as key → JSON-serialized string (the
// value column is a String for SQLite/PostgreSQL parity), so reads parse the
// JSON back and writes serialize. Rule 1 (nothing hardcoded): user-facing
// values like the institute name come from here, never from a string literal.
// All Persian error text is produced here; routes only relay it.

const DEFAULT_INSTITUTE_NAME = "موسسه حقوقی ثبت کامیاب";

/** Raised for domain rule violations (duplicate title, item in use). Routes
 *  map `field` to a form error and the message is shown verbatim. */
export class SettingsRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "SettingsRuleError";
    this.field = field;
  }
}

function parseValue<T>(raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// APPEND_SERVICE

/** Read a single setting, parsed from its JSON value. Returns null if absent. */
export async function getSetting<T = unknown>(
  key: SettingKey,
): Promise<T | null> {
  const row = await findSetting(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    // A value that isn't valid JSON is returned as the raw string.
    return row.value as unknown as T;
  }
}

/** Institute name for headings and the login page (seeded default exists). */
export async function getInstituteName(): Promise<string> {
  const name = await getSetting<string>("institute_name");
  return instituteNameSchema.safeParse(name).success
    ? (name as string)
    : DEFAULT_INSTITUTE_NAME;
}

// ---------------------------------------------------------------------------
// Institute information (B-10)
// ---------------------------------------------------------------------------

export async function getInstituteInfo(): Promise<InstituteInfo> {
  const raw = await findSettings([
    "institute_name",
    "institute_phone",
    "institute_address",
    "institute_email",
  ]);
  return {
    name: parseValue<string>(raw.institute_name) ?? "",
    phone: parseValue<string>(raw.institute_phone) ?? "",
    address: parseValue<string>(raw.institute_address) ?? "",
    email: parseValue<string>(raw.institute_email) ?? "",
  };
}

export async function saveInstituteInfo(
  input: InstituteInfoInput,
): Promise<void> {
  await saveSettings({
    institute_name: JSON.stringify(input.name),
    institute_phone: JSON.stringify(input.phone),
    institute_address: JSON.stringify(input.address ?? ""),
    institute_email: JSON.stringify(input.email ?? ""),
  });
}

// ---------------------------------------------------------------------------
// Time thresholds (B-8)
// ---------------------------------------------------------------------------

export async function getThresholds(): Promise<Thresholds> {
  const raw = await findSettings([
    "threshold_archive_days",
    "threshold_abandonment_days",
    "threshold_stale_days",
  ]);
  return {
    archiveDays: parseValue<number>(raw.threshold_archive_days) ?? 7,
    abandonmentDays: parseValue<number>(raw.threshold_abandonment_days) ?? 30,
    staleDays: parseValue<number>(raw.threshold_stale_days) ?? 10,
  };
}

export async function saveThresholds(input: ThresholdsInput): Promise<void> {
  await saveSettings({
    threshold_archive_days: JSON.stringify(input.archiveDays),
    threshold_abandonment_days: JSON.stringify(input.abandonmentDays),
    threshold_stale_days: JSON.stringify(input.staleDays),
  });
}

// ---------------------------------------------------------------------------
// Birthday greeting (B-9)
// ---------------------------------------------------------------------------

export async function getBirthday(): Promise<BirthdaySettings> {
  const raw = await findSettings([
    "birthday_greeting_enabled",
    "birthday_send_hour",
  ]);
  return {
    enabled: parseValue<boolean>(raw.birthday_greeting_enabled) ?? false,
    sendHour: parseValue<number>(raw.birthday_send_hour) ?? 10,
  };
}

export async function saveBirthday(input: BirthdayInput): Promise<void> {
  await saveSettings({
    birthday_greeting_enabled: JSON.stringify(input.enabled),
    birthday_send_hour: JSON.stringify(input.sendHour),
  });
}

// ---------------------------------------------------------------------------
// SMS gateway (B-10) — the API key is stored but never echoed back.
// ---------------------------------------------------------------------------

export async function getGateway(): Promise<GatewayView> {
  const raw = await findSettings([
    "sms_provider",
    "sms_sender_number",
    "sms_real_send",
    "sms_api_key",
  ]);
  const apiKey = parseValue<string>(raw.sms_api_key) ?? "";
  return {
    provider: parseValue<string>(raw.sms_provider) ?? "",
    senderNumber: parseValue<string>(raw.sms_sender_number) ?? "",
    realSend: parseValue<boolean>(raw.sms_real_send) ?? false,
    hasApiKey: apiKey.length > 0,
  };
}

export async function saveGateway(input: SmsGatewayInput): Promise<void> {
  const entries: Record<string, string> = {
    sms_provider: JSON.stringify(input.provider),
    sms_sender_number: JSON.stringify(input.senderNumber),
    sms_real_send: JSON.stringify(input.realSend),
  };
  // A blank key means "keep the stored one" (the client never sees the key).
  if (input.apiKey && input.apiKey.length > 0) {
    entries.sms_api_key = JSON.stringify(input.apiKey);
  }
  await saveSettings(entries);
}

/**
 * Validate that the gateway is fully configured. This is a completeness check
 * only — no message is actually sent (real delivery lands in Phase 15's engine
 * adapter). Returns a Persian message describing the result.
 */
export async function testGateway(): Promise<{ ok: boolean; message: string }> {
  const gw = await getGateway();
  const missing: string[] = [];
  if (!gw.provider) missing.push("سامانه");
  if (!gw.senderNumber) missing.push("شماره فرستنده");
  if (!gw.hasApiKey) missing.push("کلید API");
  if (missing.length > 0) {
    return {
      ok: false,
      message: `پیکربندی ناقص است: ${missing.join("، ")} تنظیم نشده است.`,
    };
  }
  return {
    ok: true,
    message: gw.realSend
      ? "پیکربندی کامل است و ارسال واقعی فعال است."
      : "پیکربندی کامل است. ارسال واقعی خاموش است؛ پیام‌ها ساخته و ثبت می‌شوند ولی ارسال نمی‌شوند.",
  };
}

// APPEND_SERVICE_2

/** Write a batch of settings (key → JSON-serialized value). */
export async function saveSettings(
  entries: Record<string, string>,
): Promise<void> {
  await saveSettingsRepo(entries);
}

// ---------------------------------------------------------------------------
// SMS templates + status (B-10, C-13)
// ---------------------------------------------------------------------------

export async function listTemplates(): Promise<SmsTemplateRow[]> {
  const rows = await listSmsTemplates();
  return rows.map((r) => ({ eventKey: r.eventKey, body: r.body }));
}

export async function updateTemplate(
  eventKey: string,
  body: string,
): Promise<void> {
  const existing = await findSmsTemplate(eventKey);
  if (!existing) {
    throw new SettingsRuleError("رویداد پیامکی یافت نشد.");
  }
  await updateSmsTemplateBody(eventKey, body);
}

export async function getSmsStatus(): Promise<SmsStatusView> {
  const [counts, failures] = await Promise.all([
    countSmsByStatus(),
    listRecentFailures(),
  ]);
  return {
    sent: counts.SENT ?? 0,
    queued: counts.QUEUED ?? 0,
    failed: counts.FAILED ?? 0,
    recentFailures: failures.map((f) => ({
      id: f.id,
      recipient: f.recipient,
      templateKey: f.templateKey,
      error: f.error,
      createdAt: f.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Managed lists (B-5, B-6, B-7)
// ---------------------------------------------------------------------------

/** Persian unit noun for the "item in use" message, per referencing entity. */
const USAGE_UNIT: Record<ListKind, string> = {
  departments: "کارمند",
  categories: "خدمت",
  paymentMethods: "پرداخت",
  cancellationReasons: "پرونده",
  followUpResults: "پیگیری",
};

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function listListItems(kind: ListKind): Promise<ListItem[]> {
  const rows = await repoListItems(kind);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    active: r.active,
    order: r.order,
    usageCount: r.usageCount,
    ...(kind === "followUpResults"
      ? { effectOnRenewal: (r.effectOnRenewal ?? "NONE") as RenewalEffect }
      : {}),
  }));
}

/** Active cancellation reasons as `{ id, title }` options for the cancel dialog
 *  (C-8). The cancel service re-checks membership against this same list so a
 *  request cannot cite a disabled or unknown reason (rule 3). */
export async function listActiveCancellationReasons(): Promise<
  { id: string; title: string }[]
> {
  const rows = await repoListItems("cancellationReasons");
  return rows.filter((r) => r.active).map((r) => ({ id: r.id, title: r.title }));
}

export async function createListItem(
  kind: ListKind,
  input: { title: string; effectOnRenewal?: RenewalEffect },
): Promise<{ id: string }> {
  const order = await nextOrder(kind);
  try {
    return await createItem(kind, {
      title: input.title,
      order,
      effectOnRenewal: input.effectOnRenewal,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SettingsRuleError("موردی با این عنوان از قبل وجود دارد.", "title");
    }
    throw err;
  }
}

export async function updateListItem(
  kind: ListKind,
  id: string,
  input: { title?: string; active?: boolean; effectOnRenewal?: RenewalEffect },
): Promise<void> {
  try {
    await updateItem(kind, id, input);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SettingsRuleError("موردی با این عنوان از قبل وجود دارد.", "title");
    }
    throw err;
  }
}

export async function moveListItem(
  kind: ListKind,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await moveItem(kind, id, direction);
}

/** Delete a list item only when nothing references it (B-7). Otherwise raise a
 *  rule error telling the manager to deactivate it instead. */
export async function deleteListItem(
  kind: ListKind,
  id: string,
): Promise<void> {
  const usage = await countUsage(kind, id);
  if (usage > 0) {
    throw new SettingsRuleError(
      `این مورد در ${toPersianDigits(String(usage))} ${USAGE_UNIT[kind]} استفاده شده و تنها قابل غیرفعال‌سازی است.`,
    );
  }
  await deleteItem(kind, id);
}