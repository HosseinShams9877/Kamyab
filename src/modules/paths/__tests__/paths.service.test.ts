import { describe, it, expect, vi, beforeEach } from "vitest";

// The paths service is tested against a mocked repository — true unit tests
// (no DB). They assert the renewable/rename-only/usage rules and Persian
// messages, not Prisma.
vi.mock("../paths.repository");

import * as repo from "../paths.repository";
import {
  addStage,
  renameStage,
  addDuration,
  updateDuration,
  deleteDuration,
  PathRuleError,
} from "../paths.service";

const r = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addStage", () => {
  it("adds an initial-path stage regardless of renewable", async () => {
    r.createStage.mockResolvedValue({ id: "st1" });
    const res = await addStage("s1", { pathType: "INITIAL", title: "ثبت نام" }, false);
    expect(res).toEqual({ id: "st1" });
    expect(r.createStage).toHaveBeenCalledWith("s1", "INITIAL", "ثبت نام");
  });

  it("refuses a renewal-path stage on a non-renewable service", async () => {
    const err = await addStage(
      "s1",
      { pathType: "RENEWAL", title: "تمدید" },
      false,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(r.createStage).not.toHaveBeenCalled();
  });

  it("allows a renewal-path stage on a renewable service", async () => {
    r.createStage.mockResolvedValue({ id: "st2" });
    await addStage("s1", { pathType: "RENEWAL", title: "تمدید" }, true);
    expect(r.createStage).toHaveBeenCalledWith("s1", "RENEWAL", "تمدید");
  });
});

describe("renameStage", () => {
  it("rejects a stage that does not belong to the service", async () => {
    r.stageBelongsToService.mockResolvedValue(false);
    const err = await renameStage("s1", "st-x", { title: "جدید" }).catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(r.updateStageTitle).not.toHaveBeenCalled();
  });
});

describe("addDuration", () => {
  it("refuses when the service is not renewable", async () => {
    const err = await addDuration(
      "s1",
      { title: "۱ ساله", monthCount: 12, isDefault: true },
      false,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(r.createDuration).not.toHaveBeenCalled();
  });

  it("maps a duplicate title (P2002) to a Persian field error", async () => {
    r.createDuration.mockRejectedValue({ code: "P2002" });
    const err = await addDuration(
      "s1",
      { title: "۱ ساله", monthCount: 12, isDefault: false },
      true,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(err.field).toBe("title");
  });

  it("creates a duration for a renewable service", async () => {
    r.createDuration.mockResolvedValue({ id: "d1" });
    const res = await addDuration(
      "s1",
      { title: "۱ ساله", monthCount: 12, isDefault: true },
      true,
    );
    expect(res).toEqual({ id: "d1" });
  });
});

describe("updateDuration", () => {
  beforeEach(() => {
    r.durationBelongsToService.mockResolvedValue(true);
    r.findDuration.mockResolvedValue({ id: "d1", monthCount: 12, isDefault: true });
  });

  it("allows a title-only edit of a used duration", async () => {
    r.countDurationUsage.mockResolvedValue(2);
    r.updateDuration.mockResolvedValue(undefined);
    await updateDuration("s1", "d1", {
      title: "یک‌ساله",
      monthCount: 12,
      isDefault: true,
    });
    expect(r.updateDuration).toHaveBeenCalled();
  });

  it("blocks changing the month count of a used duration", async () => {
    r.countDurationUsage.mockResolvedValue(2);
    const err = await updateDuration("s1", "d1", {
      title: "۲ ساله",
      monthCount: 24,
      isDefault: true,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(r.updateDuration).not.toHaveBeenCalled();
  });

  it("allows changing the month count of an unused duration", async () => {
    r.countDurationUsage.mockResolvedValue(0);
    r.updateDuration.mockResolvedValue(undefined);
    await updateDuration("s1", "d1", {
      title: "۲ ساله",
      monthCount: 24,
      isDefault: true,
    });
    expect(r.updateDuration).toHaveBeenCalled();
  });
});

describe("deleteDuration", () => {
  it("refuses to delete a used duration", async () => {
    r.durationBelongsToService.mockResolvedValue(true);
    r.countDurationUsage.mockResolvedValue(1);
    const err = await deleteDuration("s1", "d1").catch((e) => e);
    expect(err).toBeInstanceOf(PathRuleError);
    expect(r.deleteDuration).not.toHaveBeenCalled();
  });

  it("deletes an unused duration", async () => {
    r.durationBelongsToService.mockResolvedValue(true);
    r.countDurationUsage.mockResolvedValue(0);
    r.deleteDuration.mockResolvedValue(undefined);
    await deleteDuration("s1", "d1");
    expect(r.deleteDuration).toHaveBeenCalledWith("d1");
  });
});
