import { describe, it, expect } from "vitest";
import {
  serviceCreateSchema,
  reminderRuleCreateSchema,
} from "../services.schema";

// Schema tests for the services domain (B-1, B-4): isomorphic Zod, including
// Persian→English digit normalization for the numeric daysBefore field.

describe("serviceCreateSchema", () => {
  it("applies defaults for renewable/status and empty description", () => {
    const parsed = serviceCreateSchema.parse({
      name: "کارت بازرگانی",
      categoryId: "c1",
    });
    expect(parsed.renewable).toBe(false);
    expect(parsed.status).toBe(true);
    expect(parsed.description).toBe("");
  });

  it("rejects a name shorter than 2 characters", () => {
    const res = serviceCreateSchema.safeParse({ name: "ا", categoryId: "c1" });
    expect(res.success).toBe(false);
  });

  it("rejects a missing category", () => {
    const res = serviceCreateSchema.safeParse({ name: "خدمت", categoryId: "" });
    expect(res.success).toBe(false);
  });

  it("rejects a description longer than 500 characters", () => {
    const res = serviceCreateSchema.safeParse({
      name: "خدمت",
      categoryId: "c1",
      description: "x".repeat(501),
    });
    expect(res.success).toBe(false);
  });
});

describe("reminderRuleCreateSchema", () => {
  it("normalizes Persian digits and accepts a negative (after-expiry) value", () => {
    const parsed = reminderRuleCreateSchema.parse({
      daysBefore: "-۷",
      channel: "SMS_TO_CUSTOMER",
      recipient: "CUSTOMER",
    });
    expect(parsed.daysBefore).toBe(-7);
    expect(parsed.active).toBe(true);
  });

  it("accepts zero (on the expiry day)", () => {
    const parsed = reminderRuleCreateSchema.parse({
      daysBefore: 0,
      channel: "INTERNAL_NOTIFICATION",
      recipient: "CASE_OWNER",
    });
    expect(parsed.daysBefore).toBe(0);
  });

  it("rejects a value beyond the ±365 range", () => {
    const res = reminderRuleCreateSchema.safeParse({
      daysBefore: 400,
      channel: "INTERNAL_NOTIFICATION",
      recipient: "CASE_OWNER",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown channel", () => {
    const res = reminderRuleCreateSchema.safeParse({
      daysBefore: 10,
      channel: "EMAIL",
      recipient: "CUSTOMER",
    });
    expect(res.success).toBe(false);
  });
});
