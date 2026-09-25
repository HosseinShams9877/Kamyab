import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// The service is tested against a mocked repository (no DB): the assertions are
// about orchestration — mobile uniqueness, the type-nulling of write data, the
// code-collision retry, the delete-vs-deactivate rule, and the read-time
// computation of case progress and balance (rule 2).
vi.mock("../customers.repository");

import * as repo from "../customers.repository";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPageData,
} from "../customers.service";
import type { CreateCustomerInput } from "../customers.schema";
import type { CustomerRow, CaseWithDetail } from "../customers.repository";

const r = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
});

function uniqueError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

function naturalInput(overrides: Partial<CreateCustomerInput> = {}): CreateCustomerInput {
  return {
    type: "NATURAL",
    fullName: "علی رضایی",
    companyName: "شرکت باید حذف شود",
    mobile: "09123456789",
    nationalId: "",
    nationalEntityId: "12345678901",
    registrationNumber: "R-1",
    birthDate: "1370/05/10",
    foundingDate: "1390/01/01",
    sendGreeting: true,
    landline: "",
    city: "تهران",
    address: "",
    notes: "",
    ...overrides,
  };
}

describe("createCustomer", () => {
  it("stores the customer and nulls the fields that do not apply to the type", async () => {
    r.findCustomerByMobile.mockResolvedValue(null);
    r.createCustomerWithCode.mockResolvedValue({ id: "cus-1", code: "CU-1404-0001" });

    const res = await createCustomer(naturalInput());

    expect(res).toEqual({ ok: true, id: "cus-1" });
    const [data] = r.createCustomerWithCode.mock.calls[0];
    expect(data.type).toBe("NATURAL");
    expect(data.fullName).toBe("علی رضایی");
    // Legal-only fields are nulled for a natural person.
    expect(data.companyName).toBeNull();
    expect(data.nationalEntityId).toBeNull();
    expect(data.registrationNumber).toBeNull();
    expect(data.foundingDate).toBeNull();
    // The natural birth date is converted to a Date.
    expect(data.birthDate).toBeInstanceOf(Date);
  });

  it("rejects a mobile already registered to another customer", async () => {
    r.findCustomerByMobile.mockResolvedValue({
      id: "other", type: "NATURAL", fullName: "رضا محمدی", companyName: null, code: "CU-1404-0009",
    });

    const res = await createCustomer(naturalInput());

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.field).toBe("mobile");
      expect(res.message).toContain("رضا محمدی");
    }
    expect(r.createCustomerWithCode).not.toHaveBeenCalled();
  });

  it("retries on a code-collision race and succeeds", async () => {
    r.findCustomerByMobile.mockResolvedValue(null);
    r.createCustomerWithCode
      .mockRejectedValueOnce(uniqueError(["code"]))
      .mockResolvedValueOnce({ id: "cus-2", code: "CU-1404-0002" });

    const res = await createCustomer(naturalInput());

    expect(res).toEqual({ ok: true, id: "cus-2" });
    expect(r.createCustomerWithCode).toHaveBeenCalledTimes(2);
  });

  it("maps a mobile-collision race back to the field", async () => {
    r.findCustomerByMobile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "other", type: "LEGAL", fullName: null, companyName: "شرکت نمونه", code: "CU-1404-0003",
      });
    r.createCustomerWithCode.mockRejectedValue(uniqueError(["mobile"]));

    const res = await createCustomer(naturalInput());

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.field).toBe("mobile");
      expect(res.message).toContain("شرکت نمونه");
    }
  });
});

describe("updateCustomer", () => {
  const row: CustomerRow = {
    id: "cus-1", code: "CU-1404-0001", type: "NATURAL", fullName: "علی", companyName: null,
    mobile: "09123456789", nationalId: null, nationalEntityId: null, registrationNumber: null,
    birthDate: null, foundingDate: null, sendGreeting: false, landline: null, city: null,
    address: null, notes: null, status: true,
  };

  it("blocks a mobile that belongs to a different customer", async () => {
    r.findCustomerRowById.mockResolvedValue(row);
    r.findCustomerByMobile.mockResolvedValue({
      id: "cus-2", type: "NATURAL", fullName: "کس دیگر", companyName: null, code: "CU-1404-0002",
    });

    const res = await updateCustomer("cus-1", naturalInput());

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.field).toBe("mobile");
    expect(r.updateCustomer).not.toHaveBeenCalled();
  });
});

describe("deleteCustomer", () => {
  it("blocks deletion when the customer has cases", async () => {
    r.countCustomerCases.mockResolvedValue(3);

    const res = await deleteCustomer("cus-1");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("۳");
    expect(r.deleteCustomer).not.toHaveBeenCalled();
  });

  it("deletes when the customer has no case", async () => {
    r.countCustomerCases.mockResolvedValue(0);
    r.deleteCustomer.mockResolvedValue(undefined);

    const res = await deleteCustomer("cus-1");

    expect(res).toEqual({ ok: true });
    expect(r.deleteCustomer).toHaveBeenCalledWith("cus-1");
  });
});

describe("getCustomerPageData — read-time computation", () => {
  const cases: CaseWithDetail[] = [
    {
      id: "case-1", number: "1404-0001", status: "IN_PROGRESS", service: { name: "ثبت شرکت" },
      periods: [
        {
          indexNumber: 1, status: "ACTIVE", totalAmount: 1000000n,
          payments: [{ amount: 400000n }],
          stages: [
            { order: 1, status: "DONE", title: "مرحله اول" },
            { order: 2, status: "NOT_NEEDED", title: "مرحله دوم" },
            { order: 3, status: "IN_PROGRESS", title: "مرحله سوم" },
          ],
        },
      ],
    },
    {
      id: "case-2", number: "1404-0002", status: "NEW", service: { name: "پلمپ دفاتر" },
      periods: [
        { indexNumber: 1, status: "ACTIVE", totalAmount: null, payments: [], stages: [] },
      ],
    },
  ];

  it("computes progress, per-case balance, and the grand total", async () => {
    r.findCasesByCustomer.mockResolvedValue(cases);
    r.findFollowUpsByCustomer.mockResolvedValue([]);

    const data = await getCustomerPageData("cus-1");

    const first = data.cases[0];
    expect(first.stagesDone).toBe(2);
    expect(first.stagesTotal).toBe(3);
    expect(first.currentStageTitle).toBe("مرحله سوم");
    expect(first.balance).toBe(600000);
    // The case with no period total shows "—" (null), not zero.
    expect(data.cases[1].balance).toBeNull();
    // Grand total counts only cases that have a total.
    expect(data.totalBalance).toBe(600000);
    expect(data.caseCount).toBe(2);
  });
});
