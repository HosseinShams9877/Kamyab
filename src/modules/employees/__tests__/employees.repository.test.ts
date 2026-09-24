import { describe, it, expect, vi, beforeEach } from "vitest";

// Verifies that the deactivation transfer is composed correctly INSIDE a single
// transaction: the right rows are reassigned, the successor is notified with the
// built message, the employee is deactivated, and the moved counts are returned.
// Prisma is mocked, so this asserts the repository's transaction body without a DB.

const tx = {
  case: { updateMany: vi.fn() },
  task: { updateMany: vi.fn() },
  notification: { create: vi.fn() },
  employee: { update: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    // Run the interactive callback against our fake transaction client.
    $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
  },
}));

import { transferWorkAndDeactivate } from "../employees.repository";

beforeEach(() => {
  vi.clearAllMocks();
  tx.case.updateMany.mockResolvedValue({ count: 3 });
  tx.task.updateMany.mockResolvedValue({ count: 2 });
  tx.notification.create.mockResolvedValue({});
  tx.employee.update.mockResolvedValue({});
});

describe("transferWorkAndDeactivate — the single transaction (rule 4)", () => {
  it("reassigns active cases and open tasks to the successor, notifies, then deactivates", async () => {
    const buildMessage = vi.fn(
      (m: { activeCases: number; openTasks: number }) =>
        `moved ${m.activeCases}/${m.openTasks}`,
    );

    const moved = await transferWorkAndDeactivate("emp-1", "emp-2", buildMessage);

    expect(moved).toEqual({ activeCases: 3, openTasks: 2 });

    // Only ACTIVE cases (NEW / IN_PROGRESS) owned by the target move to the successor.
    expect(tx.case.updateMany).toHaveBeenCalledWith({
      where: { ownerId: "emp-1", status: { in: ["NEW", "IN_PROGRESS"] } },
      data: { ownerId: "emp-2" },
    });
    // Only OPEN tasks owned by the target move.
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { ownerId: "emp-1", status: "OPEN" },
      data: { ownerId: "emp-2" },
    });
    // The successor is notified with the message built from the moved counts.
    expect(buildMessage).toHaveBeenCalledWith({ activeCases: 3, openTasks: 2 });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: { userId: "emp-2", message: "moved 3/2" },
    });
    // The target is deactivated, never deleted.
    expect(tx.employee.update).toHaveBeenCalledWith({
      where: { id: "emp-1" },
      data: { status: false },
    });
  });
});
