import type { Prisma } from "@prisma/client";
import * as repo from "./paths.repository";
import {
  PathRuleError,
  canDeleteDuration,
  durationEditViolation,
  isUniqueViolation,
  DURATION_IN_USE_DELETE,
} from "./paths.guards";
import type { DurationRow, ServicePaths } from "./paths.types";
import type {
  StageCreateInput,
  StageUpdateInput,
  StageMoveInput,
  DurationCreateInput,
  DurationUpdateInput,
} from "./paths.schema";

// Business logic for the paths domain (B-2 stages, B-3 durations). Owns all
// Persian rule messages. It never reads the Service table (rule 9: that belongs
// to the services module); instead the acting route passes in the service's
// `renewable` flag, since the renewal path and durations exist only for a
// renewable service (B-2, B-3). The single cross-module seam is
// clearServiceDefinition, invoked on the services module's delete transaction.

const STAGE_NOT_FOUND = "مرحله یافت نشد.";
const DURATION_NOT_FOUND = "مدت اعتبار یافت نشد.";
const DUPLICATE_DURATION = "مدتی با این عنوان از قبل برای این خدمت وجود دارد.";
const RENEWAL_STAGE_NEEDS_RENEWABLE =
  "این خدمت تمدیدشونده نیست؛ مسیر تمدید ندارد.";
const DURATION_NEEDS_RENEWABLE =
  "این خدمت تمدیدشونده نیست؛ مدت اعتبار ندارد.";

// --- Path stages (B-2) ------------------------------------------------------

export function getServicePaths(serviceId: string): Promise<ServicePaths> {
  return repo.getServicePaths(serviceId);
}

export async function addStage(
  serviceId: string,
  input: StageCreateInput,
  renewable: boolean,
): Promise<{ id: string }> {
  if (input.pathType === "RENEWAL" && !renewable) {
    throw new PathRuleError(RENEWAL_STAGE_NEEDS_RENEWABLE);
  }
  return repo.createStage(serviceId, input.pathType, input.title);
}

export async function renameStage(
  serviceId: string,
  stageId: string,
  input: StageUpdateInput,
): Promise<void> {
  if (!(await repo.stageBelongsToService(stageId, serviceId))) {
    throw new PathRuleError(STAGE_NOT_FOUND);
  }
  await repo.updateStageTitle(stageId, input.title);
}

export async function moveStage(
  serviceId: string,
  stageId: string,
  input: StageMoveInput,
): Promise<void> {
  if (!(await repo.stageBelongsToService(stageId, serviceId))) {
    throw new PathRuleError(STAGE_NOT_FOUND);
  }
  await repo.moveStage(stageId, input.direction);
}

export async function removeStage(
  serviceId: string,
  stageId: string,
): Promise<void> {
  if (!(await repo.stageBelongsToService(stageId, serviceId))) {
    throw new PathRuleError(STAGE_NOT_FOUND);
  }
  await repo.deleteStage(stageId);
}

// --- Validity durations (B-3) -----------------------------------------------

export function listDurations(serviceId: string): Promise<DurationRow[]> {
  return repo.listDurations(serviceId);
}

export async function addDuration(
  serviceId: string,
  input: DurationCreateInput,
  renewable: boolean,
): Promise<{ id: string }> {
  if (!renewable) throw new PathRuleError(DURATION_NEEDS_RENEWABLE);
  try {
    return await repo.createDuration(serviceId, {
      title: input.title,
      monthCount: input.monthCount,
      isDefault: input.isDefault,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new PathRuleError(DUPLICATE_DURATION, "title");
    }
    throw err;
  }
}

export async function updateDuration(
  serviceId: string,
  durationId: string,
  input: DurationUpdateInput,
): Promise<void> {
  if (!(await repo.durationBelongsToService(durationId, serviceId))) {
    throw new PathRuleError(DURATION_NOT_FOUND);
  }
  const current = await repo.findDuration(durationId);
  if (!current) throw new PathRuleError(DURATION_NOT_FOUND);

  // A used duration is rename-only: month count and default flag are frozen (B-3).
  const inUse = (await repo.countDurationUsage(durationId)) > 0;
  const violation = durationEditViolation(
    inUse,
    { monthCount: current.monthCount, isDefault: current.isDefault },
    { monthCount: input.monthCount, isDefault: input.isDefault },
  );
  if (violation) throw new PathRuleError(violation);

  try {
    await repo.updateDuration(serviceId, durationId, {
      title: input.title,
      monthCount: input.monthCount,
      isDefault: input.isDefault,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new PathRuleError(DUPLICATE_DURATION, "title");
    }
    throw err;
  }
}

export async function deleteDuration(
  serviceId: string,
  durationId: string,
): Promise<void> {
  if (!(await repo.durationBelongsToService(durationId, serviceId))) {
    throw new PathRuleError(DURATION_NOT_FOUND);
  }
  const inUse = (await repo.countDurationUsage(durationId)) > 0;
  if (!canDeleteDuration(inUse)) {
    throw new PathRuleError(DURATION_IN_USE_DELETE);
  }
  await repo.deleteDuration(durationId);
}

// --- Cross-module lifetime hook ---------------------------------------------

/**
 * Clear a service's entire path definition (stages + durations) on a caller-owned
 * transaction. The services module calls this from its hard-delete transaction so
 * both modules' rows go in one atomic step without either reaching into the
 * other's repository (rule 4 + rule 9).
 */
export function clearServiceDefinition(
  tx: Prisma.TransactionClient,
  serviceId: string,
): Promise<void> {
  return repo.clearDefinitionTx(tx, serviceId);
}

export { PathRuleError } from "./paths.guards";
