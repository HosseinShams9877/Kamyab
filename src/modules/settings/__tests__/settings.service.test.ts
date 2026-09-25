import { describe, it, expect, vi, beforeEach } from "vitest";

// The settings service is tested against a mocked repository — true unit tests
// (no DB): they assert orchestration and the Persian rule messages, not Prisma.
vi.mock("../settings.repository");

import * as repo from "../settings.repository";
import {
  createListItem,
  deleteListItem,
  moveListItem,
  listListItems,
  getGateway,
  saveGateway,
  SettingsRuleError,
} from "../settings.service";

const r = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createListItem", () => {
  it("appends at the next order position", async () => {
    r.nextOrder.mockResolvedValue(3);
    r.createItem.mockResolvedValue({ id: "new-1" });

    const res = await createListItem("departments", { title: "مالی" });

    expect(res).toEqual({ id: "new-1" });
    expect(r.createItem).toHaveBeenCalledWith("departments", {
      title: "مالی",
      order: 3,
      effectOnRenewal: undefined,
    });
  });

  it("rejects a duplicate title (P2002) with a Persian field error", async () => {
    r.nextOrder.mockResolvedValue(0);
    r.createItem.mockRejectedValue({ code: "P2002" });

    await expect(
      createListItem("categories", { title: "تکراری" }),
    ).rejects.toMatchObject({
      name: "SettingsRuleError",
      field: "title",
    });
  });
});

describe("deleteListItem", () => {
  it("deletes when the item is unused", async () => {
    r.countUsage.mockResolvedValue(0);
    r.deleteItem.mockResolvedValue({});

    await deleteListItem("paymentMethods", "pm-1");

    expect(r.deleteItem).toHaveBeenCalledWith("paymentMethods", "pm-1");
  });

  it("refuses to delete a used item and reports the count in Persian", async () => {
    r.countUsage.mockResolvedValue(14);

    const err = await deleteListItem("cancellationReasons", "cr-1").catch(
      (e) => e,
    );

    expect(err).toBeInstanceOf(SettingsRuleError);
    expect(err.message).toContain("۱۴"); // Persian digits for 14
    expect(err.message).toContain("پرونده");
    expect(r.deleteItem).not.toHaveBeenCalled();
  });
});

describe("moveListItem", () => {
  it("delegates the swap to the repository", async () => {
    r.moveItem.mockResolvedValue(undefined);
    await moveListItem("departments", "d-1", "up");
    expect(r.moveItem).toHaveBeenCalledWith("departments", "d-1", "up");
  });
});

describe("listListItems", () => {
  it("keeps effectOnRenewal only for follow-up results", async () => {
    r.listItems.mockResolvedValue([
      { id: "d1", title: "الف", active: true, order: 0, usageCount: 0 },
    ]);
    const depts = await listListItems("departments");
    expect(depts[0].effectOnRenewal).toBeUndefined();

    r.listItems.mockResolvedValue([
      {
        id: "f1",
        title: "موافق",
        active: true,
        order: 0,
        usageCount: 0,
        effectOnRenewal: "AGREES_TO_RENEW",
      },
    ]);
    const results = await listListItems("followUpResults");
    expect(results[0].effectOnRenewal).toBe("AGREES_TO_RENEW");
  });
});

describe("SMS gateway", () => {
  it("reports hasApiKey without ever exposing the key", async () => {
    r.findSettings.mockResolvedValue({
      sms_provider: JSON.stringify("kavenegar"),
      sms_sender_number: JSON.stringify("2000"),
      sms_real_send: JSON.stringify(true),
      sms_api_key: JSON.stringify("super-secret"),
    });

    const view = await getGateway();

    expect(view).toEqual({
      provider: "kavenegar",
      senderNumber: "2000",
      realSend: true,
      hasApiKey: true,
    });
    // The raw key is not part of the returned shape at all.
    expect(JSON.stringify(view)).not.toContain("super-secret");
  });

  it("has hasApiKey=false when no key is stored", async () => {
    r.findSettings.mockResolvedValue({ sms_api_key: JSON.stringify("") });
    const view = await getGateway();
    expect(view.hasApiKey).toBe(false);
  });

  it("keeps the stored key when the submitted key is blank", async () => {
    r.saveSettings.mockResolvedValue(undefined);
    await saveGateway({
      provider: "kavenegar",
      senderNumber: "2000",
      realSend: false,
      apiKey: "",
    });
    const entries = r.saveSettings.mock.calls[0][0];
    expect(entries).not.toHaveProperty("sms_api_key");
  });

  it("writes the key only when a new one is provided", async () => {
    r.saveSettings.mockResolvedValue(undefined);
    await saveGateway({
      provider: "kavenegar",
      senderNumber: "2000",
      realSend: true,
      apiKey: "new-key",
    });
    const entries = r.saveSettings.mock.calls[0][0];
    expect(entries.sms_api_key).toBe(JSON.stringify("new-key"));
  });
});
