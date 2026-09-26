import { describe, it, expect } from "vitest";
import {
  isAbandonable,
  inRenewalTab,
  daysSinceExpiry,
  type RenewalFacts,
} from "../periods.guards";

// Pure C-10 rules: the abandonment condition and the renewals-tab classification
// are computed at read time from a period's status, computed days-remaining and
// follow-up status (rule 2 — never stored), in one place so the same rule gates
// the client (button visibility, tab membership) and the server (the real gate).
// These tests pin every branch, including the "Not interested" exception and the
// tab-window boundaries.

function facts(overrides: Partial<RenewalFacts> = {}): RenewalFacts {
  return {
    status: "ACTIVE",
    daysRemaining: -40,
    followUpStatus: "NOT_FOLLOWED_UP",
    ...overrides,
  };
}

describe("isAbandonable", () => {
  const ABANDON_DAYS = 30;

  it("is false for a non-active period", () => {
    expect(isAbandonable(facts({ status: "ABANDONED" }), ABANDON_DAYS)).toBe(false);
    expect(isAbandonable(facts({ status: "RENEWED" }), ABANDON_DAYS)).toBe(false);
  });

  it("is false with no expiry (never abandoned)", () => {
    expect(isAbandonable(facts({ daysRemaining: null }), ABANDON_DAYS)).toBe(false);
  });

  it("is false while still valid (not yet expired)", () => {
    expect(isAbandonable(facts({ daysRemaining: 5 }), ABANDON_DAYS)).toBe(false);
    expect(isAbandonable(facts({ daysRemaining: 0 }), ABANDON_DAYS)).toBe(false);
  });

  it("is false for 'not interested' before expiry (needs expiry passed)", () => {
    expect(
      isAbandonable(facts({ daysRemaining: 5, followUpStatus: "NOT_INTERESTED" }), ABANDON_DAYS),
    ).toBe(false);
  });

  it("is false when expired but within the threshold", () => {
    expect(isAbandonable(facts({ daysRemaining: -10 }), ABANDON_DAYS)).toBe(false);
  });

  it("is true once expired past the threshold", () => {
    expect(isAbandonable(facts({ daysRemaining: -31 }), ABANDON_DAYS)).toBe(true);
  });

  it("treats the threshold as strict (exactly the threshold is not yet abandonable)", () => {
    expect(isAbandonable(facts({ daysRemaining: -30 }), ABANDON_DAYS)).toBe(false);
    expect(isAbandonable(facts({ daysRemaining: -31 }), ABANDON_DAYS)).toBe(true);
  });

  it("abandons a 'not interested' period as soon as it expires, ignoring the threshold", () => {
    expect(
      isAbandonable(facts({ daysRemaining: -1, followUpStatus: "NOT_INTERESTED" }), ABANDON_DAYS),
    ).toBe(true);
  });
});

describe("daysSinceExpiry", () => {
  it("is null with no expiry", () => {
    expect(daysSinceExpiry(null)).toBeNull();
  });

  it("is the negation of days-remaining", () => {
    expect(daysSinceExpiry(5)).toBe(-5);
    expect(daysSinceExpiry(-3)).toBe(3);
    expect(daysSinceExpiry(0) === 0).toBe(true); // exactly at expiry: 0 days elapsed
  });
});

describe("inRenewalTab", () => {
  it("abandoned tab shows only ABANDONED periods", () => {
    expect(inRenewalTab("abandoned", facts({ status: "ABANDONED" }))).toBe(true);
    expect(inRenewalTab("abandoned", facts({ status: "ACTIVE" }))).toBe(false);
  });

  it("main tabs exclude non-active or undated periods", () => {
    expect(inRenewalTab("all", facts({ status: "RENEWED", daysRemaining: 10 }))).toBe(false);
    expect(inRenewalTab("all", facts({ daysRemaining: null }))).toBe(false);
  });

  it("all: within 90 days ahead or already expired", () => {
    expect(inRenewalTab("all", facts({ daysRemaining: 90 }))).toBe(true);
    expect(inRenewalTab("all", facts({ daysRemaining: 91 }))).toBe(false);
    expect(inRenewalTab("all", facts({ daysRemaining: -5 }))).toBe(true);
  });

  it("urgent: 0..7 days left", () => {
    expect(inRenewalTab("urgent", facts({ daysRemaining: 0 }))).toBe(true);
    expect(inRenewalTab("urgent", facts({ daysRemaining: 7 }))).toBe(true);
    expect(inRenewalTab("urgent", facts({ daysRemaining: 8 }))).toBe(false);
    expect(inRenewalTab("urgent", facts({ daysRemaining: -1 }))).toBe(false);
  });

  it("near: 8..30 days left", () => {
    expect(inRenewalTab("near", facts({ daysRemaining: 8 }))).toBe(true);
    expect(inRenewalTab("near", facts({ daysRemaining: 30 }))).toBe(true);
    expect(inRenewalTab("near", facts({ daysRemaining: 7 }))).toBe(false);
    expect(inRenewalTab("near", facts({ daysRemaining: 31 }))).toBe(false);
  });

  it("expired: past the expiry date", () => {
    expect(inRenewalTab("expired", facts({ daysRemaining: -1 }))).toBe(true);
    expect(inRenewalTab("expired", facts({ daysRemaining: 0 }))).toBe(false);
  });

  it("no_followup: within 30 days and never followed up", () => {
    expect(
      inRenewalTab("no_followup", facts({ daysRemaining: 30, followUpStatus: "NOT_FOLLOWED_UP" })),
    ).toBe(true);
    expect(
      inRenewalTab("no_followup", facts({ daysRemaining: 30, followUpStatus: "CONTACTED" })),
    ).toBe(false);
    expect(
      inRenewalTab("no_followup", facts({ daysRemaining: 31, followUpStatus: "NOT_FOLLOWED_UP" })),
    ).toBe(false);
  });
});
