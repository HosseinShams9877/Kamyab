import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// The service is tested against a mocked repository and a mocked permissions
// module, so these are true unit tests (no DB): they assert the orchestration —
// which repository calls happen, with what arguments — not Prisma itself.
vi.mock("../employees.repository");
vi.mock("@/modules/permissions", () => ({
  setEmployeePermissions: vi.fn(),
  getEffectivePermissions: vi.fn(),
  roleDefaults: vi.fn(() => ({})),
}));

import * as repo from "../employees.repository";
import { setEmployeePermissions } from "@/modules/permissions";
import {
  createEmployee,
  updatePermissions,
  deactivateEmployee,
} from "../employees.service";

const r = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEmployee", () => {
  const input = {
    fullName: "علی رضایی",
    mobile: "09121234567",
    email: "",
    departmentId: "",
    role: "EMPLOYEE" as const,
    password: "secret123",
  };

  it("hashes the password and stores the new employee when the mobile is free", async () => {
    r.findEmployeeIdByMobile.mockResolvedValue(null);
    r.createEmployee.mockResolvedValue({ id: "emp-new" });

    const res = await createEmployee(input);

    expect(res).toEqual({ ok: true, id: "emp-new" });
    const stored = r.createEmployee.mock.calls[0][0];
    expect(stored.passwordHash).not.toBe(input.password); // never stored in clear
    expect(bcrypt.compareSync(input.password, stored.passwordHash)).toBe(true);
    expect(stored.email).toBeNull(); // "" normalized to null
    expect(stored.departmentId).toBeNull();
  });

  it("rejects a duplicate mobile (the username) with a Persian field error", async () => {
    r.findEmployeeIdByMobile.mockResolvedValue({ id: "someone" });

    const res = await createEmployee(input);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.field).toBe("mobile");
    expect(r.createEmployee).not.toHaveBeenCalled();
  });
});

describe("deactivateEmployee — orchestration", () => {
  const target = {
    id: "emp-1",
    fullName: "علی رضایی",
    mobile: "09121234567",
    email: null,
    departmentId: null,
    role: "EMPLOYEE" as const,
    status: true,
  };

  function arrange(overrides: {
    role?: "EMPLOYEE" | "MANAGER";
    otherManagers?: number;
    workload?: { activeCases: number; openTasks: number };
    successorStatus?: boolean | null;
  }) {
    r.findEmployeeById.mockResolvedValue({ ...target, role: overrides.role ?? "EMPLOYEE" });
    r.countOtherActiveManagers.mockResolvedValue(overrides.otherManagers ?? 2);
    r.countWorkload.mockResolvedValue(overrides.workload ?? { activeCases: 0, openTasks: 0 });
    r.findEmployeeStatus.mockResolvedValue(
      overrides.successorStatus == null
        ? null
        : { id: "emp-2", status: overrides.successorStatus },
    );
  }

  it("blocks self-deactivation", async () => {
    arrange({});
    const res = await deactivateEmployee("emp-1", "emp-1", null);
    expect(res).toMatchObject({ ok: false, reason: "self" });
    expect(r.transferWorkAndDeactivate).not.toHaveBeenCalled();
    expect(r.deactivateEmployee).not.toHaveBeenCalled();
  });

  it("blocks the last active manager", async () => {
    arrange({ role: "MANAGER", otherManagers: 0 });
    const res = await deactivateEmployee("mgr-boss", "emp-1", null);
    expect(res).toMatchObject({ ok: false, reason: "last_manager" });
  });

  it("requires a successor when there is active work and none was chosen", async () => {
    arrange({ workload: { activeCases: 7, openTasks: 4 } });
    const res = await deactivateEmployee("mgr-boss", "emp-1", null);
    expect(res).toMatchObject({
      ok: false,
      reason: "successor_required",
      workload: { activeCases: 7, openTasks: 4 },
    });
    expect(r.transferWorkAndDeactivate).not.toHaveBeenCalled();
  });

  // APPEND_MARKER_3

  it("transfers work and deactivates in one repository transaction when a valid successor is given", async () => {
    arrange({ workload: { activeCases: 3, openTasks: 2 }, successorStatus: true });
    r.transferWorkAndDeactivate.mockResolvedValue({ activeCases: 3, openTasks: 2 });

    const res = await deactivateEmployee("mgr-boss", "emp-1", "emp-2");

    expect(res).toEqual({ ok: true, transferred: { activeCases: 3, openTasks: 2 } });
    expect(r.transferWorkAndDeactivate).toHaveBeenCalledTimes(1);
    const [targetId, successorId, buildMessage] = r.transferWorkAndDeactivate.mock.calls[0];
    expect(targetId).toBe("emp-1");
    expect(successorId).toBe("emp-2");
    // The injected message builder produces the Persian successor notification.
    const msg = buildMessage({ activeCases: 3, openTasks: 2 });
    expect(msg).toContain("«علی رضایی»");
    expect(msg).toContain("۳ پرونده فعال");
    expect(r.deactivateEmployee).not.toHaveBeenCalled();
  });

  it("deactivates immediately (no transfer) when the employee has no active work", async () => {
    arrange({ workload: { activeCases: 0, openTasks: 0 } });
    r.deactivateEmployee.mockResolvedValue(undefined);

    const res = await deactivateEmployee("mgr-boss", "emp-1", null);

    expect(res).toEqual({ ok: true, transferred: { activeCases: 0, openTasks: 0 } });
    expect(r.deactivateEmployee).toHaveBeenCalledWith("emp-1");
    expect(r.transferWorkAndDeactivate).not.toHaveBeenCalled();
  });
});

describe("updatePermissions", () => {
  it("delegates to the permissions module with the employee's current role", async () => {
    r.findEmployeeById.mockResolvedValue({
      id: "emp-1",
      fullName: "x",
      mobile: "09120000000",
      email: null,
      departmentId: null,
      role: "SUPERVISOR",
      status: true,
    });
    const effective = { "reports.view": false } as never;
    vi.mocked(setEmployeePermissions).mockResolvedValue(effective);

    const desired = { "reports.view": false };
    const res = await updatePermissions("emp-1", desired);

    expect(setEmployeePermissions).toHaveBeenCalledWith("emp-1", "SUPERVISOR", desired);
    expect(res).toEqual({ ok: true, effective });
  });
});
