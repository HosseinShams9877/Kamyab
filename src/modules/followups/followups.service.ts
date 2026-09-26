import { parseJalali, toGregorianDate, toJalali, formatJalali } from "@/lib/jalali";
import type { Authorizable } from "@/modules/permissions";
import { runCaseMutation } from "@/modules/cases";
import { getActivePeriod, setPeriodFollowUpTx } from "@/modules/periods";
import {
  getTaskForAction,
  canRecordResult,
  closeTaskTx,
  createTaskTx,
} from "@/modules/tasks";
import { listListItems } from "@/modules/settings";
import type { RenewalEffect } from "@/types/enums";
import * as repo from "./followups.repository";
import { periodEffect } from "./followups.guards";
import {
  RESULT_INVALID,
  TASK_NOT_FOUND,
  TASK_FORBIDDEN,
  TASK_ALREADY_CLOSED,
  TASK_NEEDS_CASE,
} from "./followups.guards";
import type { RecordResultInput } from "./followups.schema";
import type { FollowUpResultOption, FollowUpRow } from "./followups.types";

// Business logic for the followups domain (C-11 record-result + B-6). The service
// orchestrates the record-result transaction across four modules (rule 9): the
// active follow-up results come from @/modules/settings, the task writes (close +
// optional next task) from @/modules/tasks, the effect-on-renewal period update
// from @/modules/periods, and the whole thing runs inside @/modules/cases'
// runCaseMutation so the task close, the follow-up insert, the period update and
// the next-task create are ONE atomic step alongside Case.lastActivityAt + the
// ActivityHistory row (rule 4). This module imports tasks; tasks never imports it,
// so the module DAG stays acyclic.

/** A record-result outcome the API route maps to an HTTP status. */
export type FollowUpActionResult =
  | { ok: true }
  | { ok: false; code: 403 | 404 | 409 | 422; message: string };

/** A stored Date back to an ASCII Jalali "YYYY/MM/DD" string. */
function dateToJalali(date: Date): string {
  return formatJalali(toJalali(date), { persianDigits: false });
}

/** The active follow-up results, for the record-result picker (settings seam,
 *  B-6). Ordered as settings orders them; the effect drives the period update. */
export async function listActiveResults(): Promise<FollowUpResultOption[]> {
  const items = await listListItems("followUpResults");
  return items
    .filter((i) => i.active)
    .map((i) => ({
      id: i.id,
      title: i.title,
      effectOnRenewal: (i.effectOnRenewal ?? "NONE") as RenewalEffect,
    }));
}

/** A case's follow-up timeline (newest first), for the case page Tasks tab. */
export async function listCaseFollowUps(caseId: string): Promise<FollowUpRow[]> {
  const rows = await repo.findFollowUpsByCase(caseId);
  return rows.map((r) => ({
    id: r.id,
    resultTitle: r.result.title,
    effectOnRenewal: r.result.effectOnRenewal as RenewalEffect,
    note: r.note,
    taskTitle: r.task?.title ?? null,
    createdByName: r.createdBy.fullName,
    createdAt: dateToJalali(r.createdAt),
  }));
}

// APPEND_RECORD

/**
 * Record a follow-up result for a task (C-11 / B-6). In one transaction: close the
 * task (COMPLETED), write the follow-up to the case timeline, apply the result's
 * effect-on-renewal to the case's active period (B-6), and — if "next task" was
 * checked — create a continuation task (same owner, chosen due date). The task
 * must be OPEN and attached to a case (a follow-up requires a case). Authorization
 * is record-scoped (rule 3): `tasks.record_result` on the task's owner.
 */
export async function recordResult(
  user: Authorizable,
  taskId: string,
  input: RecordResultInput,
): Promise<FollowUpActionResult> {
  const task = await getTaskForAction(taskId);
  if (!task) return { ok: false, code: 404, message: TASK_NOT_FOUND };
  if (!canRecordResult(user, task.ownerId)) {
    return { ok: false, code: 403, message: TASK_FORBIDDEN };
  }
  if (task.status !== "OPEN") return { ok: false, code: 409, message: TASK_ALREADY_CLOSED };
  if (!task.caseId) return { ok: false, code: 409, message: TASK_NEEDS_CASE };
  const caseId = task.caseId;

  const results = await listActiveResults();
  const result = results.find((r) => r.id === input.resultId);
  if (!result) return { ok: false, code: 409, message: RESULT_INVALID };

  // The follow-up belongs to the case's active period; the effect (B-6) may also
  // change that period's follow-up status / abandon it.
  const activePeriod = await getActivePeriod(caseId);
  const periodId = activePeriod?.id ?? null;
  const effect = periodEffect(result.effectOnRenewal);

  const note = input.note && input.note.trim() ? input.note.trim() : null;

  // The optional continuation task (same owner, chosen date; title falls back to
  // the closed task's title). The schema has already validated the date exists.
  const nextTask = input.nextTask
    ? {
        title:
          input.nextTaskTitle && input.nextTaskTitle.trim()
            ? input.nextTaskTitle.trim()
            : task.title,
        dueDate: toGregorianDate(parseJalali(input.nextTaskDueDate!.trim())!),
      }
    : null;

  await runCaseMutation({
    caseId,
    actorId: user.id,
    promoteFromNew: false,
    apply: async (tx) => {
      await closeTaskTx(tx, taskId);
      await repo.createFollowUpTx(tx, {
        taskId,
        caseId,
        periodId,
        resultId: result.id,
        note,
        createdById: user.id,
      });
      if (effect && activePeriod) {
        await setPeriodFollowUpTx(tx, activePeriod.id, effect);
      }
      if (nextTask) {
        await createTaskTx(tx, {
          title: nextTask.title,
          caseId,
          ownerId: task.ownerId,
          dueDate: nextTask.dueDate,
          priority: "NORMAL",
          note: null,
          createdById: user.id,
        });
      }
    },
    historyAction: "followup.recorded",
    historyDetail: JSON.stringify({
      taskId,
      resultId: result.id,
      effect: result.effectOnRenewal,
      nextTask: nextTask !== null,
    }),
  });

  return { ok: true };
}
