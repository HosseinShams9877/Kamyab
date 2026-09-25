import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { PathType } from "@/types/enums";
import type { DurationRow, PathStageRow, ServicePaths } from "./paths.types";

// ALL Prisma access for the paths domain (ServicePathStage + ServiceDuration).
// Called only by paths.service. Persian text never appears here — ids, counts,
// and rows. Stage order is the `order` Int column; the two paths (INITIAL /
// RENEWAL) share the table and are separated by `pathType`.

// --- Path stages (B-2) ------------------------------------------------------

/** Both ordered stage lists for a service, split by path type. */
export async function getServicePaths(serviceId: string): Promise<ServicePaths> {
  const rows = await prisma.servicePathStage.findMany({
    where: { serviceId },
    orderBy: { order: "asc" },
    select: { id: true, title: true, order: true, pathType: true },
  });
  const initial: PathStageRow[] = [];
  const renewal: PathStageRow[] = [];
  for (const r of rows) {
    const stage = { id: r.id, title: r.title, order: r.order };
    if (r.pathType === "RENEWAL") renewal.push(stage);
    else initial.push(stage);
  }
  return { initial, renewal };
}

/** Ordered stages of one path (used by move to find neighbors). */
function listStagesOfPath(
  serviceId: string,
  pathType: PathType,
): Promise<{ id: string; order: number }[]> {
  return prisma.servicePathStage.findMany({
    where: { serviceId, pathType },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
}

/** Next order value for a path (append at the end). */
async function nextStageOrder(
  serviceId: string,
  pathType: PathType,
): Promise<number> {
  const rows = await listStagesOfPath(serviceId, pathType);
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.order)) + 1;
}

export async function createStage(
  serviceId: string,
  pathType: PathType,
  title: string,
): Promise<{ id: string }> {
  const order = await nextStageOrder(serviceId, pathType);
  return prisma.servicePathStage.create({
    data: { serviceId, pathType, title, order },
    select: { id: true },
  });
}

export async function updateStageTitle(id: string, title: string): Promise<void> {
  await prisma.servicePathStage.update({ where: { id }, data: { title } });
}

export async function deleteStage(id: string): Promise<void> {
  await prisma.servicePathStage.delete({ where: { id } });
}

/**
 * Move a stage up or down by swapping its `order` with the adjacent stage of the
 * SAME path, in one transaction. No-op at a boundary or when the id is unknown.
 */
export async function moveStage(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const stage = await prisma.servicePathStage.findUnique({
    where: { id },
    select: { serviceId: true, pathType: true },
  });
  if (!stage) return;
  const rows = await listStagesOfPath(
    stage.serviceId,
    stage.pathType as PathType,
  );
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return;
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= rows.length) return;
  const current = rows[index];
  const neighbor = rows[neighborIndex];
  await prisma.$transaction([
    prisma.servicePathStage.update({
      where: { id: current.id },
      data: { order: neighbor.order },
    }),
    prisma.servicePathStage.update({
      where: { id: neighbor.id },
      data: { order: current.order },
    }),
  ]);
}

/** Confirm a stage belongs to the given service (route-level guard). */
export async function stageBelongsToService(
  stageId: string,
  serviceId: string,
): Promise<boolean> {
  const row = await prisma.servicePathStage.findFirst({
    where: { id: stageId, serviceId },
    select: { id: true },
  });
  return row !== null;
}

// --- Validity durations (B-3) -----------------------------------------------

export async function listDurations(serviceId: string): Promise<DurationRow[]> {
  const rows = await prisma.serviceDuration.findMany({
    where: { serviceId },
    orderBy: [{ active: "desc" }, { monthCount: "asc" }],
    select: { id: true, title: true, monthCount: true, isDefault: true, active: true },
  });
  const usages = await Promise.all(rows.map((r) => countDurationUsage(r.id)));
  return rows.map((r, i) => ({
    id: r.id,
    title: r.title,
    monthCount: r.monthCount,
    isDefault: r.isDefault,
    active: r.active,
    inUse: usages[i] > 0,
  }));
}

export function findDuration(
  id: string,
): Promise<{ id: string; monthCount: number; isDefault: boolean; active: boolean } | null> {
  return prisma.serviceDuration.findUnique({
    where: { id },
    select: { id: true, monthCount: true, isDefault: true, active: true },
  });
}

/**
 * How many cases/periods use this duration (B-3 delete guard). The current
 * schema stores a period's expiry date directly and keeps NO durationId link
 * back to ServiceDuration, so there is nothing to count yet — this is a
 * documented seam that returns 0 until the periods phase adds the link.
 */
export function countDurationUsage(_durationId: string): Promise<number> {
  return Promise.resolve(0);
}

/**
 * Create a duration. When it is marked default, any existing default for the same
 * service is cleared first — only one duration may be default (B-3). One
 * transaction so the "exactly one default" invariant never flickers.
 */
export async function createDuration(
  serviceId: string,
  data: { title: string; monthCount: number; isDefault: boolean },
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.serviceDuration.updateMany({
        where: { serviceId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.serviceDuration.create({
      data: { serviceId, ...data },
      select: { id: true },
    });
  });
}

/** Update a duration, keeping the single-default invariant in one transaction. */
export async function updateDuration(
  serviceId: string,
  id: string,
  data: { title: string; monthCount: number; isDefault: boolean },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.serviceDuration.updateMany({
        where: { serviceId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    await tx.serviceDuration.update({ where: { id }, data });
  });
}

export async function deleteDuration(id: string): Promise<void> {
  await prisma.serviceDuration.delete({ where: { id } });
}

/**
 * Activate / deactivate a duration (B-3). Deactivation is always allowed (even
 * for a used duration): it only hides the duration from case registration, the
 * row and its history stay intact. monthCount and isDefault are untouched.
 */
export async function setDurationActive(id: string, active: boolean): Promise<void> {
  await prisma.serviceDuration.update({ where: { id }, data: { active } });
}

/** Confirm a duration belongs to the given service (route-level guard). */
export async function durationBelongsToService(
  durationId: string,
  serviceId: string,
): Promise<boolean> {
  const row = await prisma.serviceDuration.findFirst({
    where: { id: durationId, serviceId },
    select: { id: true },
  });
  return row !== null;
}

// --- Cross-module lifetime hook ---------------------------------------------

/**
 * Delete every path stage and duration of a service on the GIVEN transaction
 * client. Called by the services module's hard-delete transaction (rule 9: the
 * services module owns Service, this module owns its path/duration tables, so
 * the shared delete runs through this public seam on one tx).
 */
export async function clearDefinitionTx(
  tx: Prisma.TransactionClient,
  serviceId: string,
): Promise<void> {
  await tx.servicePathStage.deleteMany({ where: { serviceId } });
  await tx.serviceDuration.deleteMany({ where: { serviceId } });
}
