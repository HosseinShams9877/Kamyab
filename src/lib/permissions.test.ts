import { describe, it, expect } from "vitest";
import {
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  roleDefaults,
  applyExceptions,
  can,
  scopeByOwnership,
  type PermissionMap,
  type Authorizable,
} from "./permissions";

const user = (
  id: string,
  permissions: PermissionMap,
): Authorizable => ({ id, permissions });

describe("permission catalog & role defaults (C-12)", () => {
  it("every role default covers exactly the catalog keys — no drift", () => {
    for (const role of ["MANAGER", "SUPERVISOR", "EMPLOYEE"] as const) {
      const keys = Object.keys(ROLE_DEFAULTS[role]).sort();
      expect(keys).toEqual([...PERMISSION_KEYS].sort());
    }
  });

  it("Manager defaults to full access", () => {
    expect(Object.values(ROLE_DEFAULTS.MANAGER).every(Boolean)).toBe(true);
  });

  it("Supervisor defaults exclude employee management and settings editing", () => {
    const s = ROLE_DEFAULTS.SUPERVISOR;
    expect(s["employees.create"]).toBe(false);
    expect(s["employees.edit"]).toBe(false);
    expect(s["employees.change_permissions"]).toBe(false);
    expect(s["settings.edit"]).toBe(false);
    // but still broad elsewhere
    expect(s["cases.view_all"]).toBe(true);
    expect(s["employees.view"]).toBe(true);
  });

  it("Employee defaults are owner-scoped (view_own, not view_all)", () => {
    const e = ROLE_DEFAULTS.EMPLOYEE;
    expect(e["cases.view_own"]).toBe(true);
    expect(e["cases.view_all"]).toBe(false);
    expect(e["tasks.view_own"]).toBe(true);
    expect(e["tasks.view_all"]).toBe(false);
    expect(e["employees.view"]).toBe(false);
    expect(e["settings.edit"]).toBe(false);
    expect(e["financial.record_payment"]).toBe(false);
  });

  it("roleDefaults returns a fresh copy (mutating it never touches the shared map)", () => {
    const copy = roleDefaults("EMPLOYEE");
    copy["cases.view_all"] = true;
    expect(ROLE_DEFAULTS.EMPLOYEE["cases.view_all"]).toBe(false);
  });
});

describe("applyExceptions — effective = role default overridden by exception", () => {
  it("grants a permission the role default denies", () => {
    const eff = applyExceptions("EMPLOYEE", [
      { permissionKey: "cases.view_all", allowed: true },
    ]);
    expect(eff["cases.view_all"]).toBe(true);
    // untouched keys keep the default
    expect(eff["cases.view_own"]).toBe(true);
    expect(eff["employees.view"]).toBe(false);
  });

  it("revokes a permission the role default grants", () => {
    const eff = applyExceptions("MANAGER", [
      { permissionKey: "settings.edit", allowed: false },
    ]);
    expect(eff["settings.edit"]).toBe(false);
    expect(eff["settings.view"]).toBe(true);
  });

  it("ignores unknown/stale permission keys", () => {
    const eff = applyExceptions("EMPLOYEE", [
      { permissionKey: "not.a.real.key", allowed: true },
    ]);
    expect(Object.keys(eff).sort()).toEqual([...PERMISSION_KEYS].sort());
    expect((eff as Record<string, boolean>)["not.a.real.key"]).toBeUndefined();
  });

  it("no exceptions => exactly the role default", () => {
    expect(applyExceptions("SUPERVISOR", [])).toEqual(ROLE_DEFAULTS.SUPERVISOR);
  });
});

describe("can — the server-side guard", () => {
  const manager = user("m1", roleDefaults("MANAGER"));
  const employee = user("e1", roleDefaults("EMPLOYEE"));

  it("plain action lookup honours the effective map", () => {
    expect(can(manager, "employees.view")).toBe(true);
    expect(can(employee, "employees.view")).toBe(false);
    expect(can(employee, "cases.create")).toBe(true);
    expect(can(employee, "cases.cancel")).toBe(false);
  });

  it("record-scoped: an owner-only user may act on their own record only", () => {
    const own = { ownerId: "e1" };
    const other = { ownerId: "e2" };
    expect(can(employee, "cases.edit", own)).toBe(true);
    expect(can(employee, "cases.edit", other)).toBe(false);
  });

  it("record-scoped: a view_all user may act on any record", () => {
    expect(can(manager, "cases.edit", { ownerId: "someone-else" })).toBe(true);
  });

  it("a denied action stays denied even for one's own record", () => {
    // Employee lacks cases.cancel; owning the record does not grant it.
    expect(can(employee, "cases.cancel", { ownerId: "e1" })).toBe(false);
  });

  it("an exception granting view_all lifts the ownership restriction", () => {
    const promoted = user(
      "e1",
      applyExceptions("EMPLOYEE", [
        { permissionKey: "cases.view_all", allowed: true },
      ]),
    );
    expect(can(promoted, "cases.edit", { ownerId: "e2" })).toBe(true);
  });
});

describe("scopeByOwnership — the query-level view all vs view own", () => {
  it("view_all => no ownership filter", () => {
    expect(scopeByOwnership(user("m1", roleDefaults("MANAGER")), "cases")).toEqual(
      {},
    );
  });

  it("view_own only => filter to the user's own id", () => {
    expect(
      scopeByOwnership(user("e1", roleDefaults("EMPLOYEE")), "tasks"),
    ).toEqual({ ownerId: "e1" });
  });

  it("neither => null (caller must refuse)", () => {
    const blind = applyExceptions("EMPLOYEE", [
      { permissionKey: "cases.view_own", allowed: false },
    ]);
    expect(scopeByOwnership(user("e1", blind), "cases")).toBeNull();
  });
});
