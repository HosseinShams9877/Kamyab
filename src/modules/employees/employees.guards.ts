import type { Role } from "@/types/enums";
import { toPersianDigits } from "@/lib/digits";
import type { Workload } from "./employees.types";

// PURE decision logic for the employees domain (C-12 guards). No I/O, no Prisma —
// every fact needed for a decision is passed in, so these functions are trivially
// unit-testable and the same rules cannot drift between call sites.

export type DeactivationContext = {
  // The manager performing the action, and the employee being deactivated.
  actorId: string;
  target: { id: string; role: Role; status: boolean };
  // Count of OTHER active managers (the target is already excluded by the caller).
  otherActiveManagers: number;
  workload: Workload;
  // The chosen successor, if any, with its current active status.
  successor: { id: string; status: boolean } | null;
};

export type DeactivationDecision =
  | { allowed: true; transfer: boolean }
  | {
      allowed: false;
      reason: "self" | "last_manager" | "already_inactive" | "successor_required" | "successor_invalid";
    };

// The order of these checks matters: identity and last-manager guards are
// absolute and take precedence over the work-transfer flow.
export function evaluateDeactivation(ctx: DeactivationContext): DeactivationDecision {
  if (ctx.target.status === false) {
    return { allowed: false, reason: "already_inactive" };
  }
  // No employee can deactivate their own account.
  if (ctx.actorId === ctx.target.id) {
    return { allowed: false, reason: "self" };
  }
  // The last active manager cannot be deactivated (the system must always keep
  // at least one manager who can log in).
  if (ctx.target.role === "MANAGER" && ctx.otherActiveManagers === 0) {
    return { allowed: false, reason: "last_manager" };
  }

  const hasWork = ctx.workload.activeCases > 0 || ctx.workload.openTasks > 0;
  if (hasWork) {
    if (!ctx.successor) {
      return { allowed: false, reason: "successor_required" };
    }
    // A successor must be someone else and currently active.
    if (ctx.successor.id === ctx.target.id || ctx.successor.status === false) {
      return { allowed: false, reason: "successor_invalid" };
    }
    return { allowed: true, transfer: true };
  }

  // No active work → deactivate immediately, nothing to transfer.
  return { allowed: true, transfer: false };
}

// Persian message shown when deactivation is blocked pending a successor, e.g.
// "این کارمند ۷ پرونده فعال و ۴ وظیفهٔ باز دارد. مالک جدید را مشخص کنید."
export function buildSuccessorRequiredMessage(w: Workload): string {
  return `این کارمند ${toPersianDigits(String(w.activeCases))} پرونده فعال و ${toPersianDigits(
    String(w.openTasks),
  )} وظیفهٔ باز دارد. مالک جدید را مشخص کنید.`;
}

// Persian notification sent to the successor after a successful transfer.
export function buildTransferNotification(targetName: string, w: Workload): string {
  return `«${targetName}» غیرفعال شد. ${toPersianDigits(String(w.activeCases))} پرونده فعال و ${toPersianDigits(
    String(w.openTasks),
  )} وظیفهٔ باز به شما منتقل شد.`;
}
