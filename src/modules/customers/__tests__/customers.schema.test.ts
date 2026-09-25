import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  setCustomerStatusSchema,
} from "../customers.schema";

// Shared validation (C-3). These run in the browser and on the server, so the
// tests pin the type-branching, digit normalization, and field rules that the
// API relies on to reject hand-crafted requests.

function naturalInput(overrides: Record<string, unknown> = {}) {
  return {
    type: "NATURAL",
    fullName: "علی رضایی",
    companyName: "",
    mobile: "09123456789",
    nationalId: "",
    nationalEntityId: "",
    registrationNumber: "",
    birthDate: "",
    foundingDate: "",
    sendGreeting: false,
    landline: "",
    city: "",
    address: "",
    notes: "",
    ...overrides,
  };
}

function legalInput(overrides: Record<string, unknown> = {}) {
  return naturalInput({ type: "LEGAL", fullName: "", companyName: "شرکت نمونه", ...overrides });
}

/** The `path` of the first validation issue, for asserting which field failed. */
function firstErrorPath(input: unknown): string | undefined {
  const res = createCustomerSchema.safeParse(input);
  if (res.success) return undefined;
  return res.error.issues[0]?.path.join(".");
}

describe("createCustomerSchema — type branching", () => {
  it("accepts a minimal natural person", () => {
    expect(createCustomerSchema.safeParse(naturalInput()).success).toBe(true);
  });

  it("requires a full name for a natural person", () => {
    expect(firstErrorPath(naturalInput({ fullName: "" }))).toBe("fullName");
  });

  it("accepts a minimal legal entity", () => {
    expect(createCustomerSchema.safeParse(legalInput()).success).toBe(true);
  });

  it("requires a company name for a legal entity", () => {
    expect(firstErrorPath(legalInput({ companyName: "" }))).toBe("companyName");
  });
});

describe("createCustomerSchema — mobile", () => {
  it("normalizes Persian digits and passes", () => {
    const res = createCustomerSchema.safeParse(naturalInput({ mobile: "۰۹۱۲۳۴۵۶۷۸۹" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.mobile).toBe("09123456789");
  });

  it("rejects a malformed mobile", () => {
    expect(firstErrorPath(naturalInput({ mobile: "12345" }))).toBe("mobile");
  });
});

describe("createCustomerSchema — identity and dates", () => {
  it("rejects an invalid national ID for a natural person", () => {
    expect(firstErrorPath(naturalInput({ nationalId: "1234567890" }))).toBe("nationalId");
  });

  it("accepts a valid national ID", () => {
    expect(createCustomerSchema.safeParse(naturalInput({ nationalId: "1234567891" })).success).toBe(true);
  });

  it("requires an 11-digit national entity ID for a legal entity", () => {
    expect(firstErrorPath(legalInput({ nationalEntityId: "123" }))).toBe("nationalEntityId");
    expect(createCustomerSchema.safeParse(legalInput({ nationalEntityId: "12345678901" })).success).toBe(true);
  });

  it("rejects a future birth date", () => {
    expect(firstErrorPath(naturalInput({ birthDate: "1500/01/01" }))).toBe("birthDate");
  });

  it("accepts a past birth date", () => {
    expect(createCustomerSchema.safeParse(naturalInput({ birthDate: "1370/05/10" })).success).toBe(true);
  });
});

describe("setCustomerStatusSchema", () => {
  it("accepts a boolean status", () => {
    expect(setCustomerStatusSchema.safeParse({ status: true }).success).toBe(true);
  });

  it("rejects a non-boolean status", () => {
    expect(setCustomerStatusSchema.safeParse({ status: "yes" }).success).toBe(false);
  });
});
