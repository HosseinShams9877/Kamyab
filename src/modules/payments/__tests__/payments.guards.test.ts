import { describe, it, expect } from "vitest";
import { paymentStatus, paymentPercent } from "../payments.guards";

// Pure C-7 financial rules: the status label and the payment percentage are
// computed at read time (rule 2 — never stored). These tests pin every branch
// the case page and the panel rely on, including the empty-total and
// overpayment cases the spec calls out explicitly.

describe("paymentStatus", () => {
  it("is unpaid when nothing is agreed and nothing is received", () => {
    expect(paymentStatus(null, 0)).toBe("unpaid");
  });

  it("is a prepayment when money arrives before any total is agreed", () => {
    expect(paymentStatus(null, 500)).toBe("prepayment");
  });

  it("is unpaid when a total is agreed but nothing is paid", () => {
    expect(paymentStatus(1000, 0)).toBe("unpaid");
  });

  it("is a prepayment when part of the total is paid", () => {
    expect(paymentStatus(1000, 400)).toBe("prepayment");
  });

  it("is settled when the total is paid exactly", () => {
    expect(paymentStatus(1000, 1000)).toBe("settled");
  });

  it("is overpaid when more than the total is paid", () => {
    expect(paymentStatus(1000, 1500)).toBe("overpaid");
  });

  it("is settled at a zero total with nothing received", () => {
    expect(paymentStatus(0, 0)).toBe("settled");
  });

  it("is overpaid at a zero total once anything is received", () => {
    expect(paymentStatus(0, 200)).toBe("overpaid");
  });
});

describe("paymentPercent", () => {
  it("is null when there is no total to divide by", () => {
    expect(paymentPercent(null, 500)).toBeNull();
  });

  it("is null when the total is zero", () => {
    expect(paymentPercent(0, 200)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(paymentPercent(1000, 333)).toBe(33);
    expect(paymentPercent(1000, 335)).toBe(34);
  });

  it("is 100 when the total is paid exactly", () => {
    expect(paymentPercent(1000, 1000)).toBe(100);
  });

  it("can exceed 100 on overpayment", () => {
    expect(paymentPercent(1000, 1500)).toBe(150);
  });
});
