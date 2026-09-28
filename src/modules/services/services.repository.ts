import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ReminderChannel, ReminderRecipient } from "@/types/enums";
import type {
  ReminderRuleRow,
  ServiceDetail,
  ServiceListItem,
} from "./services.types";

// ALL Prisma access for the services domain (Service + ReminderRule). Called only
// by services.service. Persian text never appears here — ids, counts, and rows.

export async function listServices(): Promise<ServiceListItem[]> {
  const rows = await prisma.service.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      renewable: true,
      status: true,
      category: { select: { title: true } },
      _count: { select: { cases: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryTitle: r.category.title,
    renewable: r.renewable,
    status: r.status,
    caseCount: r._count.cases,
  }));
}

export async function findServiceById(id: string): Promise<ServiceDetail | null> {
  return prisma.service.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      categoryId: true,
      description: true,
      renewable: true,
      status: true,
    },
  });
}

/** Active services for the case-registration pick (C-4). */
export async function listActiveServices(): Promise<
  { id: string; name: string; renewable: boolean }[]
> {
  return prisma.service.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, renewable: true },
  });
}

export type CreateServiceData = {
  name: string;
  categoryId: string;
  description: string | null;
  renewable: boolean;
  status: boolean;
};

export async function createService(
  data: CreateServiceData,
): Promise<{ id: string }> {
  return prisma.service.create({ data, select: { id: true } });
}

export async function updateService(
  id: string,
  data: CreateServiceData,
): Promise<void> {
  await prisma.service.update({ where: { id }, data });
}

export async function setServiceStatus(id: string, status: boolean): Promise<void> {
  await prisma.service.update({ where: { id }, data: { status } });
}

export function countServiceCases(serviceId: string): Promise<number> {
  return prisma.case.count({ where: { serviceId } });
}

/** True when the category exists and is active (create/update guard). */
export async function categoryExists(id: string): Promise<boolean> {
  const row = await prisma.serviceCategory.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Hard-delete a service and its entire definition in ONE transaction (rule 4).
 * The reminder rules belong to this module; the path stages and durations belong
 * to the paths module, so the caller injects `clearDefinition` — a paths-service
 * function that deletes those rows on the SAME transaction client (rule 9: the
 * services module never touches the paths repository).
 */
export async function hardDeleteService(
  serviceId: string,
  clearDefinition: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await clearDefinition(tx);
    await tx.reminderRule.deleteMany({ where: { serviceId } });
    await tx.service.delete({ where: { id: serviceId } });
  });
}

// --- Reminder rules (B-4) ---------------------------------------------------

export async function listReminderRules(
  serviceId: string,
): Promise<ReminderRuleRow[]> {
  const rows = await prisma.reminderRule.findMany({
    where: { serviceId },
    orderBy: { daysBefore: "desc" },
    select: {
      id: true,
      daysBefore: true,
      channel: true,
      recipient: true,
      active: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    daysBefore: r.daysBefore,
    channel: r.channel as ReminderChannel,
    recipient: r.recipient as ReminderRecipient,
    active: r.active,
  }));
}

export type ReminderRuleData = {
  daysBefore: number;
  channel: ReminderChannel;
  recipient: ReminderRecipient;
  active: boolean;
};

export async function createReminderRule(
  serviceId: string,
  data: ReminderRuleData,
): Promise<{ id: string }> {
  return prisma.reminderRule.create({
    data: { serviceId, ...data },
    select: { id: true },
  });
}

export async function updateReminderRule(
  id: string,
  data: Partial<ReminderRuleData>,
): Promise<void> {
  await prisma.reminderRule.update({ where: { id }, data });
}

export async function deleteReminderRule(id: string): Promise<void> {
  await prisma.reminderRule.delete({ where: { id } });
}

/** Confirm a reminder rule belongs to the given service (route-level guard). */
export async function reminderRuleBelongsToService(
  ruleId: string,
  serviceId: string,
): Promise<boolean> {
  const row = await prisma.reminderRule.findFirst({
    where: { id: ruleId, serviceId },
    select: { id: true },
  });
  return row !== null;
}

// --- Service stats (B-1 list header) ----------------------------------------

/** Total number of services (active + inactive). */
export function countServices(): Promise<number> {
  return prisma.service.count();
}

/** Services whose status is true (active). */
export function countActiveServices(): Promise<number> {
  return prisma.service.count({ where: { status: true } });
}

/** Services that are renewable (regardless of active). */
export function countRenewableServices(): Promise<number> {
  return prisma.service.count({ where: { renewable: true } });
}

/** Total number of active reminder rules across all services. */
export function countActiveReminderRules(): Promise<number> {
  return prisma.reminderRule.count({ where: { active: true } });
}