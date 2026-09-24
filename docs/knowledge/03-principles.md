# Founding Principles and Deliberately-Fixed Items

> Source: section A-1 (three principles) and section B-0 (deliberately-fixed items).

## The three founding principles

### Principle 1 — Everything changeable, from inside the system
Anything that might change tomorrow, the manager must be able to change from inside the system. Adding a new service, changing the stages of a job, adding a new cancellation reason — **none of these may require a developer.**

### Principle 2 — A computable number is never stored
No number that can be computed is stored. "Balance" comes from the sum of payments, "days remaining" from the date, "progress percentage" from the stages. No one may write "settled" while no payment is recorded.

**Numbers that are always computed (never stored):**
- Financial balance of each period (total amount minus sum of payments)
- Path progress percentage (from stage statuses)
- Days remaining until expiry (from the date)
- Task overdue status (from due date and today)
- Financial status label (unpaid, prepayment, settled, overpaid)
- Payment percentage
- Dashboard counts (active cases, near renewals, outstanding receivables, etc.)

### Principle 3 — Nothing is ever deleted
A case is cancelled, a task is archived, a renewal is abandoned, a customer is deactivated, a service is deactivated — but the record stays. What leaves the main screen is only clutter, not information. (The "full delete" exceptions are allowed only where the document explicitly says so and no dependent data exists — e.g. deleting a customer with no case, deleting a task with no follow-up, or deleting a settings-list item used nowhere.)

## Deliberately-fixed items (must NOT be manager-changeable)

A few things are deliberately fixed, because the system's logic is built on them and changing them would break the system. This is an intentional restriction, not an oversight:

| Fixed item | Values | Why it is fixed |
|------------|--------|-----------------|
| Case lifecycle statuses | New, In Progress, Completed, Cancelled | reports, dashboard, and filters count on them |
| Stage statuses | Pending, In Progress, Done, Rejected, Not Needed | progress percentage is computed on them |
| Period statuses | Active, Renewed, Cancelled, Abandoned | the renewal-cycle logic is built on them |
| Three base roles | Manager, Supervisor, Employee | permission starting point; but each role's permissions are fully configurable |
| Three task priority levels | Normal, High, Urgent | filters and display are built on them |
| Two customer types | Natural person, Legal entity | form fields are tied to them |

## Strategic note about "new status"

If the manager says "I want to add a new status to a case", the correct answer is usually to cover that situation with **a stage in the path** or **a cancellation reason**, not by adding a status. Lifecycle statuses are fixed.
