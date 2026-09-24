import { describe, it, expect } from "vitest";
import {
  evaluateDeactivation,
  buildSuccessorRequiredMessage,
  buildTransferNotification,
  type DeactivationContext,
} from "../employees.guards";

// Pure guard tests for the deactivation flow (C-12). No DB — the evaluator is
// fed every fact directly, so each rule is asserted in isolation.

const base: DeactivationContext = {
  actorId: "manager-1",
  target: { id: "emp-1", role: "EMPLOYEE", status: true },
  otherActiveManagers: 2,
  workload: { activeCases: 0, openTasks: 0 },
  successor: null,
};

describe("evaluateDeactivation — guards", () => {
  it("blocks deactivating your own account", () => {
    const d = evaluateDeactivation({ ...base, actorId: "emp-1" });
    expect(d).toEqual({ allowed: false, reason: "self" });
  });

  it("blocks the last active manager", () => {
    const d = evaluateDeactivation({
      ...base,
      target: { id: "mgr-9", role: "MANAGER", status: true },
      otherActiveManagers: 0,
    });
    expect(d).toEqual({ allowed: false, reason: "last_manager" });
  });

  it("allows deactivating a manager while others remain", () => {
    const d = evaluateDeactivation({
      ...base,
      target: { id: "mgr-9", role: "MANAGER", status: true },
      otherActiveManagers: 1,
    });
    expect(d).toEqual({ allowed: true, transfer: false });
  });

  it("rejects an already-inactive employee", () => {
    const d = evaluateDeactivation({
      ...base,
      target: { id: "emp-1", role: "EMPLOYEE", status: false },
    });
    expect(d).toEqual({ allowed: false, reason: "already_inactive" });
  });

  it("requires a successor when the employee has active work", () => {
    const d = evaluateDeactivation({
      ...base,
      workload: { activeCases: 7, openTasks: 4 },
      successor: null,
    });
    expect(d).toEqual({ allowed: false, reason: "successor_required" });
  });

  it("rejects a successor that is the target or is inactive", () => {
    const withWork = { ...base, workload: { activeCases: 1, openTasks: 0 } };
    expect(
      evaluateDeactivation({ ...withWork, successor: { id: "emp-1", status: true } }),
    ).toEqual({ allowed: false, reason: "successor_invalid" });
    expect(
      evaluateDeactivation({ ...withWork, successor: { id: "emp-2", status: false } }),
    ).toEqual({ allowed: false, reason: "successor_invalid" });
  });

  it("allows transfer when work exists and the successor is valid", () => {
    const d = evaluateDeactivation({
      ...base,
      workload: { activeCases: 3, openTasks: 2 },
      successor: { id: "emp-2", status: true },
    });
    expect(d).toEqual({ allowed: true, transfer: true });
  });

  it("allows immediate deactivation (no transfer) when there is no work", () => {
    expect(evaluateDeactivation(base)).toEqual({ allowed: true, transfer: false });
  });

  it("identity and last-manager guards take precedence over the work flow", () => {
    // Has work AND is self → still blocked as self, not successor_required.
    const d = evaluateDeactivation({
      ...base,
      actorId: "emp-1",
      workload: { activeCases: 5, openTasks: 0 },
    });
    expect(d).toEqual({ allowed: false, reason: "self" });
  });
});

describe("Persian message builders (Persian digits)", () => {
  it("successor-required message carries the counts in Persian digits", () => {
    const msg = buildSuccessorRequiredMessage({ activeCases: 7, openTasks: 4 });
    expect(msg).toContain("۷ پرونده فعال");
    expect(msg).toContain("۴ وظیفهٔ باز");
    expect(msg).toContain("مالک جدید");
  });

  it("transfer notification names the employee and the moved counts", () => {
    const msg = buildTransferNotification("علی رضایی", { activeCases: 12, openTasks: 0 });
    expect(msg).toContain("«علی رضایی»");
    expect(msg).toContain("۱۲ پرونده فعال");
    expect(msg).toContain("۰ وظیفهٔ باز");
  });
});
