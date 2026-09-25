import { describe, it, expect, vi, beforeEach } from "vitest";

// The services service is tested against a mocked repository and mocked sibling
// modules — true unit tests (no DB). They assert orchestration and the Persian
// rule messages, not Prisma.
vi.mock("../services.repository");
vi.mock("@/modules/settings", () => ({ listListItems: vi.fn() }));
vi.mock("@/modules/paths", () => ({ clearServiceDefinition: vi.fn() }));

import * as repo from "../services.repository";
import { listListItems } from "@/modules/settings";
import {
  listCategoryOptions,
  createService,
  updateService,
  deleteService,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  ServiceRuleError,
} from "../services.service";

const r = vi.mocked(repo);
const mockedListListItems = vi.mocked(listListItems);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCategoryOptions", () => {
  it("keeps only active categories, mapped to {id,title}", async () => {
    mockedListListItems.mockResolvedValue([
      { id: "c1", title: "ثبت شرکت", active: true, order: 0, usageCount: 0 },
      { id: "c2", title: "قدیمی", active: false, order: 1, usageCount: 0 },
    ]);
    const options = await listCategoryOptions();
    expect(options).toEqual([{ id: "c1", title: "ثبت شرکت" }]);
    expect(mockedListListItems).toHaveBeenCalledWith("categories");
  });
});

describe("createService", () => {
  const input = {
    name: "کارت بازرگانی",
    categoryId: "c1",
    description: "  ",
    renewable: true,
    status: true,
  };

  it("rejects an unknown/inactive category with a field error", async () => {
    r.categoryExists.mockResolvedValue(false);
    const res = await createService(input);
    expect(res).toEqual({
      ok: false,
      field: "categoryId",
      message: expect.stringContaining("دسته‌بندی"),
    });
    expect(r.createService).not.toHaveBeenCalled();
  });

  it("creates with a whitespace-only description normalized to null", async () => {
    r.categoryExists.mockResolvedValue(true);
    r.createService.mockResolvedValue({ id: "s1" });
    const res = await createService(input);
    expect(res).toEqual({ ok: true, id: "s1" });
    expect(r.createService).toHaveBeenCalledWith({
      name: "کارت بازرگانی",
      categoryId: "c1",
      description: null,
      renewable: true,
      status: true,
    });
  });

  it("maps a duplicate name (P2002) to a Persian field error", async () => {
    r.categoryExists.mockResolvedValue(true);
    r.createService.mockRejectedValue({ code: "P2002" });
    const res = await createService(input);
    expect(res).toMatchObject({ ok: false, field: "name" });
  });
});

describe("updateService", () => {
  it("fails when the service is missing", async () => {
    r.findServiceById.mockResolvedValue(null);
    const res = await updateService("missing", {
      name: "x",
      categoryId: "c1",
      description: "",
      renewable: false,
      status: true,
    });
    expect(res).toMatchObject({ ok: false, field: "id" });
  });
});

describe("deleteService", () => {
  it("refuses to delete a service that has cases", async () => {
    r.countServiceCases.mockResolvedValue(3);
    const err = await deleteService("s1").catch((e) => e);
    expect(err).toBeInstanceOf(ServiceRuleError);
    expect(err.message).toContain("۳");
    expect(r.hardDeleteService).not.toHaveBeenCalled();
  });

  it("hard-deletes when no case exists, passing the paths clear callback", async () => {
    r.countServiceCases.mockResolvedValue(0);
    r.hardDeleteService.mockResolvedValue(undefined);
    await deleteService("s1");
    expect(r.hardDeleteService).toHaveBeenCalledWith("s1", expect.any(Function));
  });
});

describe("reminder rules", () => {
  it("refuses to add a rule to a non-renewable service", async () => {
    r.findServiceById.mockResolvedValue({
      id: "s1",
      name: "x",
      categoryId: "c1",
      description: null,
      renewable: false,
      status: true,
    });
    const err = await createReminderRule("s1", {
      daysBefore: 30,
      channel: "SMS_TO_CUSTOMER",
      recipient: "CUSTOMER",
      active: true,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceRuleError);
    expect(r.createReminderRule).not.toHaveBeenCalled();
  });

  it("creates a rule for a renewable service", async () => {
    r.findServiceById.mockResolvedValue({
      id: "s1",
      name: "x",
      categoryId: "c1",
      description: null,
      renewable: true,
      status: true,
    });
    r.createReminderRule.mockResolvedValue({ id: "rr1" });
    const res = await createReminderRule("s1", {
      daysBefore: 30,
      channel: "SMS_TO_CUSTOMER",
      recipient: "CUSTOMER",
      active: true,
    });
    expect(res).toEqual({ id: "rr1" });
    expect(r.createReminderRule).toHaveBeenCalledWith("s1", {
      daysBefore: 30,
      channel: "SMS_TO_CUSTOMER",
      recipient: "CUSTOMER",
      active: true,
    });
  });

  it("rejects updating a rule that does not belong to the service", async () => {
    r.reminderRuleBelongsToService.mockResolvedValue(false);
    const err = await updateReminderRule("s1", "rr-x", {
      daysBefore: 0,
      channel: "INTERNAL_NOTIFICATION",
      recipient: "CASE_OWNER",
      active: true,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceRuleError);
    expect(r.updateReminderRule).not.toHaveBeenCalled();
  });

  it("deletes a rule that belongs to the service", async () => {
    r.reminderRuleBelongsToService.mockResolvedValue(true);
    r.deleteReminderRule.mockResolvedValue(undefined);
    await deleteReminderRule("s1", "rr1");
    expect(r.deleteReminderRule).toHaveBeenCalledWith("rr1");
  });
});
