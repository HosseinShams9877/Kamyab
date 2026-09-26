import { describe, it, expect } from "vitest";
import {
  OVERDUE_TASK_ALERT_THRESHOLD,
  UNFOLLOWED_RENEWAL_WINDOW_DAYS,
  isReminderDue,
  isBirthdayToday,
  renewalReminderMessage,
  overdueTasksAlertPrefix,
  overdueTasksAlertMessage,
  unfollowedRenewalPrefix,
  unfollowedRenewalMessage,
} from "../engine.guards";

// Pure C-14 engine decisions + Persian text. The "≤" due window (so a MISSED
// scheduler run is made up next run), the 30-Esfand → 29-Esfand birthday fold,
// and the stable anti-repeat prefixes (which must be a prefix of the full message,
// or the 24h dedupe would never match) are all pinned here. Everything is pure —
// no ports, no Prisma — so these run without any fake.

describe("isReminderDue", () => {
  it("is due exactly on the window boundary (≤, not <)", () => {
    // daysBefore = 30 → the rule fires from 30 days out and onward.
    expect(isReminderDue(30, 30)).toBe(true);
  });

  it("is due once inside the window, including past expiry (a made-up run)", () => {
    expect(isReminderDue(10, 30)).toBe(true);
    expect(isReminderDue(0, 30)).toBe(true);
    expect(isReminderDue(-5, 30)).toBe(true); // scheduler was down — still made up
  });

  it("is not due before the window opens", () => {
    expect(isReminderDue(31, 30)).toBe(false);
  });

  it("handles an on-expiry rule (daysBefore = 0)", () => {
    expect(isReminderDue(0, 0)).toBe(true);
    expect(isReminderDue(1, 0)).toBe(false);
    expect(isReminderDue(-1, 0)).toBe(true);
  });

  it("handles an after-expiry rule (negative daysBefore)", () => {
    expect(isReminderDue(-3, -3)).toBe(true);
    expect(isReminderDue(-2, -3)).toBe(false); // not yet 3 days after expiry
    expect(isReminderDue(-4, -3)).toBe(true);
  });
});

describe("isBirthdayToday", () => {
  it("matches on month + day, ignoring the year", () => {
    expect(isBirthdayToday({ jm: 3, jd: 15 }, { jy: 1404, jm: 3, jd: 15 })).toBe(true);
    expect(isBirthdayToday({ jm: 3, jd: 15 }, { jy: 1403, jm: 3, jd: 15 })).toBe(true);
  });

  it("does not match a different month or day", () => {
    expect(isBirthdayToday({ jm: 3, jd: 15 }, { jy: 1404, jm: 3, jd: 16 })).toBe(false);
    expect(isBirthdayToday({ jm: 3, jd: 15 }, { jy: 1404, jm: 4, jd: 15 })).toBe(false);
  });

  it("folds a 30-Esfand birthday onto 29 Esfand in a common (non-leap) year", () => {
    // 1404 is a common year → Esfand has 29 days; a 30-Esfand person is greeted on the 29th.
    expect(isBirthdayToday({ jm: 12, jd: 30 }, { jy: 1404, jm: 12, jd: 29 })).toBe(true);
  });

  it("does not fold when Esfand actually has 30 days (a leap year)", () => {
    // 1403 is a leap year → Esfand has 30 days, so 29 Esfand is NOT the anniversary.
    expect(isBirthdayToday({ jm: 12, jd: 30 }, { jy: 1403, jm: 12, jd: 29 })).toBe(false);
    // …the real 30 Esfand still matches in that leap year.
    expect(isBirthdayToday({ jm: 12, jd: 30 }, { jy: 1403, jm: 12, jd: 30 })).toBe(true);
  });
});

describe("anti-repeat prefixes are a prefix of their full message", () => {
  it("overdue-task alert: prefix ⊂ message (so the 24h dedupe matches)", () => {
    const prefix = overdueTasksAlertPrefix("علی رضایی");
    const message = overdueTasksAlertMessage("علی رضایی", 5);
    expect(message.startsWith(prefix)).toBe(true);
    expect(prefix).not.toContain("۵"); // the count must not leak into the stable prefix
  });

  it("unfollowed-renewal alert: prefix ⊂ message", () => {
    const prefix = unfollowedRenewalPrefix("1404-12");
    const message = unfollowedRenewalMessage("1404-12", 3);
    expect(message.startsWith(prefix)).toBe(true);
  });
});

describe("Persian message content", () => {
  it("renewal reminder names the service and case", () => {
    const msg = renewalReminderMessage("1404-7", "ثبت برند");
    expect(msg).toContain("ثبت برند");
    expect(msg).toContain("یادآوری تمدید");
  });
});

describe("thresholds", () => {
  it("holds the documented C-14 constants", () => {
    expect(OVERDUE_TASK_ALERT_THRESHOLD).toBe(3);
    expect(UNFOLLOWED_RENEWAL_WINDOW_DAYS).toBe(7);
  });
});
