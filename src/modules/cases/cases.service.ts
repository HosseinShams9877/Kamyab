import { Prisma } from "@prisma/client";
import {
  parseJalali,
  toGregorianDate,
  addMonths,
  todayJalali,
} from "@/lib/jalali";
import { getService, listActiveServiceOptions } from "@/modules/services";
import { getServicePaths, listDurations } from "@/modules/paths";
import { listActiveCustomerOptions, saveCaseBirthInfoTx } from "@/modules/customers";
import { listCaseOwnerOptions } from "@/modules/employees";
import {
  createRegistrationPeriodTx,
  getPeriodsForCase,
  currentPeriod,
  stageProgress,
  type PeriodRow,
  type StageTemplate,
} from "@/modules/periods";
import type { CustomerType, CaseStatus } from "@/types/enums";
import * as repo from "./cases.repository";
import type { CaseCreateInput } from "./cases.schema";
import {
  CUSTOMER_INVALID,
  SERVICE_INVALID,
  OWNER_INVALID,
  NO_DURATION_DEFINED,
  DURATION_REQUIRED,
  DURATION_INVALID,
  daysRemainingUntil,
} from "./cases.guards";
import type {
  CaseFormData,
  CaseHeader,
  ServiceCaseMeta,
  OwnerOption,
} from "./cases.types";

// Business logic for the cases domain (C-4 registration, C-5 page). The service
// is the module's only cross-module entry point (rule 9): the service's
// renewable flag + name come from @/modules/services, the initial-path stages
// and validity durations from @/modules/paths, the customer birth-info patch
// from @/modules/customers, and the first period + copied stages from
// @/modules/periods. The single registration write is one transaction (rule 4),
// owned by the repository; this service prepares its inputs, builds the Persian
// notification + JSON history payloads, and retries on a number-collision race.

const CREATE_RETRIES = 5;

function isNumberCollision(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function displayName(row: repo.CaseCoreRow["customer"]): string {
  return row.type === "NATURAL"
    ? row.fullName ?? "—"
    : row.companyName ?? "—";
}

// --- Case-registration form data (C-4) --------------------------------------

/** The pick lists the registration form renders, plus an optional prefilled
 *  customer (from the "register case" button on a customer page). */
export async function getCaseFormData(
  presetCustomerId: string | null,
): Promise<CaseFormData> {
  const [customers, services, ownerRows] = await Promise.all([
    listActiveCustomerOptions(),
    listActiveServiceOptions(),
    listCaseOwnerOptions(),
  ]);
  const owners: OwnerOption[] = ownerRows.map((o) => ({
    id: o.id,
    fullName: o.fullName,
  }));
  return {
    customers,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      renewable: s.renewable,
    })),
    owners,
    presetCustomerId:
      presetCustomerId && customers.some((c) => c.id === presetCustomerId)
        ? presetCustomerId
        : null,
  };
}

/**
 * Live meta for a picked service (C-4): whether it is renewable (drives the
 * duration/expiry section), how many initial stages it has (the hint), and its
 * active validity durations with the default marked. Null when the service is
 * unknown or inactive.
 */
export async function getServiceCaseMeta(
  serviceId: string,
): Promise<ServiceCaseMeta | null> {
  const service = await getService(serviceId);
  if (!service || !service.status) return null;

  const [paths, durations] = await Promise.all([
    getServicePaths(serviceId),
    service.renewable ? listDurations(serviceId) : Promise.resolve([]),
  ]);

  return {
    serviceId,
    renewable: service.renewable,
    stageCount: paths.initial.length,
    durations: durations
      .filter((d) => d.active)
      .map((d) => ({
        id: d.id,
        title: d.title,
        monthCount: d.monthCount,
        isDefault: d.isDefault,
      })),
  };
}

// --- Registration (C-4 save transaction) ------------------------------------

type RegisterResult =
  | { ok: true; id: string; number: string }
  | { ok: false; field?: string; message: string };

/**
 * Register a case (C-4). Validates the three references and, for a renewable
 * service, the chosen validity duration; computes the expiry by Jalali calendar
 * months (rule: never add fixed days); copies the service's initial path stages;
 * then writes the case + first period + stages, backfills the customer's
 * birth-info, notifies the owner, and records history — all in one transaction
 * (rule 4). A number-collision race is retried.
 */
export async function registerCase(
  actorId: string,
  input: CaseCreateInput,
): Promise<RegisterResult> {
  const service = await getService(input.serviceId);
  if (!service || !service.status) {
    return { ok: false, field: "serviceId", message: SERVICE_INVALID };
  }

  const customer = await repo.findCustomerForRegister(input.customerId);
  if (!customer || !customer.status) {
    return { ok: false, field: "customerId", message: CUSTOMER_INVALID };
  }

  if (!(await repo.ownerIsActive(input.ownerId))) {
    return { ok: false, field: "ownerId", message: OWNER_INVALID };
  }

  const startJ = parseJalali(input.startDate);
  if (!startJ) {
    return { ok: false, field: "startDate", message: "تاریخ شروع معتبر نیست." };
  }
  const startDate = toGregorianDate(startJ);

  // Renewable services carry a validity duration and an expiry; non-renewable
  // ones have neither (the period is still created, with a null expiry).
  let expiryDate: Date | null = null;
  if (service.renewable) {
    const durations = (await listDurations(input.serviceId)).filter((d) => d.active);
    if (durations.length === 0) {
      return { ok: false, field: "durationId", message: NO_DURATION_DEFINED };
    }
    const durationId = input.durationId?.trim() ?? "";
    if (!durationId) {
      return { ok: false, field: "durationId", message: DURATION_REQUIRED };
    }
    const duration = durations.find((d) => d.id === durationId);
    if (!duration) {
      return { ok: false, field: "durationId", message: DURATION_INVALID };
    }
    expiryDate = toGregorianDate(addMonths(startJ, duration.monthCount));
  }

  const paths = await getServicePaths(input.serviceId);
  const stages: StageTemplate[] = paths.initial.map((s) => ({
    title: s.title,
    order: s.order,
  }));

  const totalAmount = input.totalAmount === null ? null : BigInt(input.totalAmount);
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  const customerType = customer.type as CustomerType;
  const jalaliYear = todayJalali().jy;

  const args: repo.CreateCaseTxArgs = {
    customerId: input.customerId,
    serviceId: input.serviceId,
    ownerId: input.ownerId,
    actorId,
    notes,
    jalaliYear,
    writePeriod: (tx, caseId) =>
      createRegistrationPeriodTx(tx, {
        caseId,
        startDate,
        expiryDate,
        totalAmount,
        stages,
      }).then(() => undefined),
    writeBirthInfo: (tx) =>
      saveCaseBirthInfoTx(tx, input.customerId, {
        type: customerType,
        birthDate: input.birthDate || undefined,
        foundingDate: input.foundingDate || undefined,
        sendGreeting: input.sendGreeting,
      }),
    buildOwnerMessage: (number) =>
      `پروندهٔ جدید ${number} (${service.name}) به شما ارجاع شد.`,
    buildHistoryDetail: (number) =>
      JSON.stringify({
        number,
        serviceId: input.serviceId,
        customerId: input.customerId,
        ownerId: input.ownerId,
      }),
  };

  for (let attempt = 0; attempt < CREATE_RETRIES; attempt++) {
    try {
      const { id, number } = await repo.createCaseTx(args);
      return { ok: true, id, number };
    } catch (e) {
      if (isNumberCollision(e)) continue; // number race — regenerate and retry
      throw e;
    }
  }
  return {
    ok: false,
    message: "ثبت شمارهٔ پرونده ناموفق بود. دوباره تلاش کنید.",
  };
}

// --- Case page (C-5) --------------------------------------------------------

export type CasePage = {
  header: CaseHeader;
  periods: PeriodRow[];
  current: PeriodRow | null;
};

/**
 * The case page (C-5). The header is fully live: start/expiry come from the
 * current period, daysRemaining and progress are computed at read time (rule 2),
 * never stored. Returns null when the case does not exist.
 */
export async function getCasePage(id: string): Promise<CasePage | null> {
  const core = await repo.findCaseCore(id);
  if (!core) return null;

  const periods = await getPeriodsForCase(id);
  const current = currentPeriod(periods);
  const progress = stageProgress(current);

  const header: CaseHeader = {
    id: core.id,
    number: core.number,
    status: core.status as CaseStatus,
    customerId: core.customerId,
    customerName: displayName(core.customer),
    serviceName: core.service.name,
    ownerId: core.ownerId,
    ownerName: core.owner.fullName,
    startDate: current?.startDate ?? null,
    expiryDate: current?.expiryDate ?? null,
    daysRemaining: daysRemainingUntil(current?.expiryDate ?? null),
    progressPassed: progress.passed,
    progressTotal: progress.total,
  };

  return { header, periods, current };
}
