import { prisma } from "@/lib/db";
import type { ListKind } from "./settings.types";

// Data access for the settings domain. The key-value Setting store holds
// JSON-serialized strings (String column for SQLite/PostgreSQL parity); parsing
// is the service's concern. The five managed lists are real tables sharing a
// uniform shape, dispatched here by ListKind. Usage counts (for the
// delete-only-if-unused rule) are read via each relation's `_count`.

// ---------------------------------------------------------------------------
// Key-value settings
// ---------------------------------------------------------------------------

/** Read a single raw Setting row by key, or null when absent. */
export function findSetting(key: string) {
  return prisma.setting.findUnique({ where: { key } });
}

/** Read many raw Setting rows at once → { key: rawValue }. */
export async function findSettings(
  keys: string[],
): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

/** Upsert many settings in one transaction (values already JSON-serialized). */
export function saveSettings(entries: Record<string, string>): Promise<unknown> {
  return prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Managed lists — raw row shape returned to the service
// ---------------------------------------------------------------------------

export type RawListItem = {
  id: string;
  title: string;
  active: boolean;
  order: number;
  effectOnRenewal?: string;
  usageCount: number;
};

// APPEND_MARKER

/** List all rows of a managed list, ordered, with usage counts. */
export async function listItems(kind: ListKind): Promise<RawListItem[]> {
  switch (kind) {
    case "departments": {
      const rows = await prisma.department.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          active: true,
          order: true,
          _count: { select: { employees: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        active: r.active,
        order: r.order,
        usageCount: r._count.employees,
      }));
    }
    case "categories": {
      const rows = await prisma.serviceCategory.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          active: true,
          order: true,
          _count: { select: { services: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        active: r.active,
        order: r.order,
        usageCount: r._count.services,
      }));
    }
    case "paymentMethods": {
      const rows = await prisma.paymentMethod.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          active: true,
          order: true,
          _count: { select: { payments: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        active: r.active,
        order: r.order,
        usageCount: r._count.payments,
      }));
    }
    case "cancellationReasons": {
      const rows = await prisma.cancellationReason.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          active: true,
          order: true,
          _count: { select: { cases: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        active: r.active,
        order: r.order,
        usageCount: r._count.cases,
      }));
    }
    case "followUpResults": {
      const rows = await prisma.followUpResult.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          active: true,
          order: true,
          effectOnRenewal: true,
          _count: { select: { followUps: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        active: r.active,
        order: r.order,
        effectOnRenewal: r.effectOnRenewal,
        usageCount: r._count.followUps,
      }));
    }
  }
}
// APPEND_MARKER_2

/** Next order value for a kind (append at the end). */
export async function nextOrder(kind: ListKind): Promise<number> {
  const items = await listItems(kind);
  return items.length === 0
    ? 0
    : Math.max(...items.map((i) => i.order)) + 1;
}

/** Create a list item. `effectOnRenewal` applies only to follow-up results. */
export function createItem(
  kind: ListKind,
  data: { title: string; order: number; effectOnRenewal?: string },
): Promise<{ id: string }> {
  switch (kind) {
    case "departments":
      return prisma.department.create({
        data: { title: data.title, order: data.order },
      });
    case "categories":
      return prisma.serviceCategory.create({
        data: { title: data.title, order: data.order },
      });
    case "paymentMethods":
      return prisma.paymentMethod.create({
        data: { title: data.title, order: data.order },
      });
    case "cancellationReasons":
      return prisma.cancellationReason.create({
        data: { title: data.title, order: data.order },
      });
    case "followUpResults":
      return prisma.followUpResult.create({
        data: {
          title: data.title,
          order: data.order,
          effectOnRenewal: data.effectOnRenewal ?? "NONE",
        },
      });
  }
}

/** Update a list item's editable fields (effectOnRenewal ignored off B-6). */
export function updateItem(
  kind: ListKind,
  id: string,
  data: { title?: string; active?: boolean; effectOnRenewal?: string },
): Promise<unknown> {
  const base: { title?: string; active?: boolean } = {};
  if (data.title !== undefined) base.title = data.title;
  if (data.active !== undefined) base.active = data.active;
  switch (kind) {
    case "departments":
      return prisma.department.update({ where: { id }, data: base });
    case "categories":
      return prisma.serviceCategory.update({ where: { id }, data: base });
    case "paymentMethods":
      return prisma.paymentMethod.update({ where: { id }, data: base });
    case "cancellationReasons":
      return prisma.cancellationReason.update({ where: { id }, data: base });
    case "followUpResults":
      return prisma.followUpResult.update({
        where: { id },
        data:
          data.effectOnRenewal !== undefined
            ? { ...base, effectOnRenewal: data.effectOnRenewal }
            : base,
      });
  }
}

/** Delete a list item (the service gates this on usageCount === 0). */
export function deleteItem(kind: ListKind, id: string): Promise<unknown> {
  switch (kind) {
    case "departments":
      return prisma.department.delete({ where: { id } });
    case "categories":
      return prisma.serviceCategory.delete({ where: { id } });
    case "paymentMethods":
      return prisma.paymentMethod.delete({ where: { id } });
    case "cancellationReasons":
      return prisma.cancellationReason.delete({ where: { id } });
    case "followUpResults":
      return prisma.followUpResult.delete({ where: { id } });
  }
}

/** Count records referencing one list item (for the delete-only-if-unused rule). */
export function countUsage(kind: ListKind, id: string): Promise<number> {
  switch (kind) {
    case "departments":
      return prisma.employee.count({ where: { departmentId: id } });
    case "categories":
      return prisma.service.count({ where: { categoryId: id } });
    case "paymentMethods":
      return prisma.payment.count({ where: { methodId: id } });
    case "cancellationReasons":
      return prisma.case.count({ where: { cancellationReasonId: id } });
    case "followUpResults":
      return prisma.followUp.count({ where: { resultId: id } });
  }
}

function setOrder(
  kind: ListKind,
  id: string,
  order: number,
): Promise<unknown> {
  switch (kind) {
    case "departments":
      return prisma.department.update({ where: { id }, data: { order } });
    case "categories":
      return prisma.serviceCategory.update({ where: { id }, data: { order } });
    case "paymentMethods":
      return prisma.paymentMethod.update({ where: { id }, data: { order } });
    case "cancellationReasons":
      return prisma.cancellationReason.update({
        where: { id },
        data: { order },
      });
    case "followUpResults":
      return prisma.followUpResult.update({ where: { id }, data: { order } });
  }
}

/**
 * Move an item up or down by swapping its `order` with the adjacent item's, in
 * one transaction. No-op at the boundary (already first/last, or id unknown).
 */
export async function moveItem(
  kind: ListKind,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const items = await listItems(kind);
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return;
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= items.length) return;
  const current = items[index];
  const neighbor = items[neighborIndex];
  await prisma.$transaction([
    setOrder(kind, current.id, neighbor.order) as never,
    setOrder(kind, neighbor.id, current.order) as never,
  ]);
}

// ---------------------------------------------------------------------------
// SMS templates + status
// ---------------------------------------------------------------------------

export function listSmsTemplates() {
  return prisma.smsTemplate.findMany({ orderBy: { eventKey: "asc" } });
}

export function findSmsTemplate(eventKey: string) {
  return prisma.smsTemplate.findUnique({ where: { eventKey } });
}

export function updateSmsTemplateBody(eventKey: string, body: string) {
  return prisma.smsTemplate.update({ where: { eventKey }, data: { body } });
}

/** Counts grouped by SMS status (QUEUED / SENT / FAILED). */
export async function countSmsByStatus(): Promise<Record<string, number>> {
  const groups = await prisma.smsMessage.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

/** Most recent failed SMS messages, for the status view. */
export function listRecentFailures(limit = 20) {
  return prisma.smsMessage.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      recipient: true,
      templateKey: true,
      error: true,
      createdAt: true,
    },
  });
}
