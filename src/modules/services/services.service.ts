import { listListItems } from "@/modules/settings";
import { clearServiceDefinition } from "@/modules/paths";
import * as repo from "./services.repository";
import {
  ServiceRuleError,
  canDeleteService,
  buildServiceHasCasesMessage,
  isUniqueViolation,
} from "./services.guards";
import type {
  CategoryOption,
  ReminderRuleRow,
  ServiceDetail,
  ServiceListItem,
} from "./services.types";
import type {
  ServiceCreateInput,
  ServiceUpdateInput,
  ReminderRuleCreateInput,
  ReminderRuleUpdateInput,
} from "./services.schema";

// Business logic for the services domain (B-1 service definition, B-4 reminder
// rules). Owns all Persian rule messages and the single delete transaction. Talks
// to other modules only through their public barrels (rule 9): categories come
// from @/modules/settings, and the path stages + durations that share a service's
// lifetime are cleared through @/modules/paths.

const DUPLICATE_NAME = "خدمتی با این نام از قبل وجود دارد.";
const CATEGORY_INVALID = "دسته‌بندی انتخاب‌شده معتبر نیست.";
const SERVICE_NOT_FOUND = "خدمت یافت نشد.";
const NOT_RENEWABLE = "این خدمت تمدیدشونده نیست؛ قاعده یادآوری ندارد.";
const RULE_NOT_FOUND = "قاعده یادآوری یافت نشد.";

export function listServices(): Promise<ServiceListItem[]> {
  return repo.listServices();
}

export function getService(id: string): Promise<ServiceDetail | null> {
  return repo.findServiceById(id);
}

/** Active categories for the service form's dropdown (rule 9: settings owns them). */
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const items = await listListItems("categories");
  return items
    .filter((i) => i.active)
    .map((i) => ({ id: i.id, title: i.title }));
}

/** Normalize an optional description: empty/whitespace becomes null. */
function descriptionOrNull(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export async function createService(
  input: ServiceCreateInput,
): Promise<{ ok: true; id: string } | { ok: false; field?: string; message: string }> {
  if (!(await repo.categoryExists(input.categoryId))) {
    return { ok: false, field: "categoryId", message: CATEGORY_INVALID };
  }
  try {
    const { id } = await repo.createService({
      name: input.name,
      categoryId: input.categoryId,
      description: descriptionOrNull(input.description),
      renewable: input.renewable,
      status: input.status,
    });
    return { ok: true, id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, field: "name", message: DUPLICATE_NAME };
    }
    throw err;
  }
}

export async function updateService(
  id: string,
  input: ServiceUpdateInput,
): Promise<{ ok: true } | { ok: false; field?: string; message: string }> {
  const current = await repo.findServiceById(id);
  if (!current) return { ok: false, field: "id", message: SERVICE_NOT_FOUND };
  if (!(await repo.categoryExists(input.categoryId))) {
    return { ok: false, field: "categoryId", message: CATEGORY_INVALID };
  }
  try {
    await repo.updateService(id, {
      name: input.name,
      categoryId: input.categoryId,
      description: descriptionOrNull(input.description),
      renewable: input.renewable,
      status: input.status,
    });
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, field: "name", message: DUPLICATE_NAME };
    }
    throw err;
  }
}

/** Quick active/inactive toggle from the list (B-1 deactivate). */
export async function setServiceStatus(id: string, status: boolean): Promise<void> {
  await repo.setServiceStatus(id, status);
}

/**
 * Delete a service (B-1). Allowed ONLY when no case has ever been built from it;
 * otherwise the caller must deactivate instead. The delete clears the whole
 * definition (stages + durations via the paths module, then reminder rules and
 * the service row) in one transaction.
 */
export async function deleteService(id: string): Promise<void> {
  const caseCount = await repo.countServiceCases(id);
  if (!canDeleteService(caseCount)) {
    throw new ServiceRuleError(buildServiceHasCasesMessage(caseCount));
  }
  await repo.hardDeleteService(id, (tx) => clearServiceDefinition(tx, id));
}

// --- Reminder rules (B-4) ---------------------------------------------------

export function listReminderRules(serviceId: string): Promise<ReminderRuleRow[]> {
  return repo.listReminderRules(serviceId);
}

/** Reminder rules exist only for renewable services (B-4). */
async function assertRenewable(serviceId: string): Promise<void> {
  const service = await repo.findServiceById(serviceId);
  if (!service) throw new ServiceRuleError(SERVICE_NOT_FOUND);
  if (!service.renewable) throw new ServiceRuleError(NOT_RENEWABLE);
}

export async function createReminderRule(
  serviceId: string,
  input: ReminderRuleCreateInput,
): Promise<{ id: string }> {
  await assertRenewable(serviceId);
  return repo.createReminderRule(serviceId, {
    daysBefore: input.daysBefore,
    channel: input.channel,
    recipient: input.recipient,
    active: input.active,
  });
}

export async function updateReminderRule(
  serviceId: string,
  ruleId: string,
  input: ReminderRuleUpdateInput,
): Promise<void> {
  if (!(await repo.reminderRuleBelongsToService(ruleId, serviceId))) {
    throw new ServiceRuleError(RULE_NOT_FOUND);
  }
  await repo.updateReminderRule(ruleId, {
    daysBefore: input.daysBefore,
    channel: input.channel,
    recipient: input.recipient,
    active: input.active,
  });
}

export async function deleteReminderRule(
  serviceId: string,
  ruleId: string,
): Promise<void> {
  if (!(await repo.reminderRuleBelongsToService(ruleId, serviceId))) {
    throw new ServiceRuleError(RULE_NOT_FOUND);
  }
  await repo.deleteReminderRule(ruleId);
}

export { ServiceRuleError } from "./services.guards";
