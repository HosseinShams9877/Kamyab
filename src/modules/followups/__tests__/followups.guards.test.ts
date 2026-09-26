import { describe, it, expect } from "vitest";
import { periodEffect } from "../followups.guards";

// Pure B-6 rule: how a follow-up result's effect-on-renewal changes the case's
// active period. The mapping keys off the stored `effectOnRenewal` value, never
// the result's title. These tests pin every branch the record-result transaction
// relies on (rule 2 / rule 4).

describe("periodEffect", () => {
  it("marks the period as agreeing to renew, without changing its status", () => {
    expect(periodEffect("AGREES_TO_RENEW")).toEqual({
      followUpStatus: "AGREES_TO_RENEW",
    });
  });

  it("abandons the period when the customer is not interested", () => {
    expect(periodEffect("NOT_INTERESTED")).toEqual({
      followUpStatus: "NOT_INTERESTED",
      status: "ABANDONED",
    });
  });

  it("leaves the period untouched when the effect is NONE", () => {
    expect(periodEffect("NONE")).toBeNull();
  });
});
