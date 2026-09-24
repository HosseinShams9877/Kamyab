# Complete Work Flows (Section D)

> Source: section D. Four main flows that, if they work from start to finish without a hitch, mean the system works.

## D-1 — From sale to delivery

The product's main flow.

1. Once at the start, the manager defines the "Business card" service: six stages for the initial-registration path, five stages for the renewal path, a "1 year" duration equal to 12 months, and five reminder rules. This is done only once.
2. The customer "Arman Tejarat Pars" calls. Maryam registers the customer: legal type, national entity ID, mobile, founding date, greeting checkbox on. The code CU-1405-0013 is created.
3. Maryam registers the case: customer, Business-card service, "1 year" duration, start date 1405/07/01, amount 7,500,000 Toman, herself as owner. The system computes the expiry date 1406/07/01.
4. On save: number PR-1405-0284 is created, the six stages are copied, the "Receive documents" stage becomes In Progress, and the first period is created.
5. The customer pays three million as prepayment. Maryam records the receipt on the financial card. The balance becomes 4,500,000 and the label "prepayment received".
6. Maryam gets the documents and presses "Done" on the first stage. The second stage starts automatically and the case's "current stage" changes.
7. At the "Chamber of Commerce approval" stage the case gets a deficiency. Maryam presses "Reject" and writes the reason. The attempt counter becomes 1 and the stage stays open.
8. For follow-up, Maryam creates a task: "Call the Chamber of Commerce", due tomorrow, high priority.
9. The next day she calls and records the result "Customer answered". The task closes and the follow-up sits in the timeline. The task is auto-archived seven days later.
10. The deficiency is resolved. Maryam presses "Done" on the same stage and the path advances.
11. The customer pays the rest. Maryam records the receipt. The balance becomes zero and the label "settled".
12. The last stage "Card issuance" is done. "Current stage" becomes "all stages done" and the case status becomes "Completed".

> **What was never entered by hand in this flow:** the expiry date, the balance, the progress percentage, the current stage, the task overdue status. All were computed.

## D-2 — The renewal cycle

The flow that turns a one-time sale into a recurring relationship. It is the reason the system "does not forget".

1. The case from D-1 is complete, its first period active, expiry date 1406/07/01.
2. As the expiry approaches, the **automatic engine** starts firing the service's reminder rules against that period — each due rule only once (see the reminder rules in [04-manager-defined.md](04-manager-defined.md)). 30 days before → internal notification to the owner; 15 days before → notification to owner and managers; 7 days before → SMS to the customer; and so on. The due condition is "less than or equal to", so a missed engine run does not lose a reminder.
3. The period appears on the renewals page (tabs: Urgent / Near / No follow-up) and on the dashboard's "near renewals" count. Its expiry status ("7 days left") and its follow-up status ("Not followed up") are shown separately.
4. Maryam calls the customer and records a follow-up. If she records the result "Agrees to renew" (a result whose "effect on renewal" field is set), the period's follow-up status changes to "Agrees to renew" automatically — she does not touch it in two places.
5. Maryam registers the renewal: new start date (default = the previous period's end date), the "1 year" duration, renewal amount. In one transaction: the previous period closes and becomes "Renewed", a new period (Period 2) is created, the case's expiry date updates to the new period's expiry, the service's **renewal path** stages are copied onto the new period, and its first stage becomes "In Progress". The path card's title becomes "Renewal path — Period 2".
6. The reminder cycle restarts for the new period, and the cycle repeats a year later.

**The alternative branch — the customer does not renew:**
- If Maryam records "Not interested", the period goes straight to **abandoned** with no waiting for the threshold.
- If no one follows up and no renewal is registered, then once the period is more than the abandonment threshold (default 30 days) past its expiry, the engine marks it **abandoned**. It leaves the main tabs, drops out of the "near renewals" count, and all reminders/SMS stop for it.
- An abandoned period can still be manually **restored** to follow-up, which resumes its reminders.

> **Why the two statuses stay apart:** "3 days left" (expiry status, from the date) and "not yet contacted" (follow-up status, from people's actions) together answer the one question no spreadsheet answers — which renewal is near and still untouched?

## D-3 — Mid-path cancellation

A case stopped in the middle, always recorded with a reason.

1. A case is in progress — say 3 open stages, 2 open tasks, and a 4,500,000 Toman balance. The customer withdraws.
2. Whoever has cancel permission opens the cancel dialog. It shows a warning summarizing the open stages, open tasks, and balance, then asks for a **cancellation reason** (dropdown of active reasons, mandatory) and an optional note. The confirm button is disabled until a reason is picked.
3. On confirm, one transaction does all of the following:
   - The case status becomes "Cancelled" and the cancellation date, reason, note, and canceller's name are recorded.
   - The path is locked; open stages stay open so it is clear where it stopped.
   - The active period is cancelled so no reminder or SMS is issued.
   - All open tasks of this case are cancelled and their owners get a notification.
   - The case drops out of the counts of active cases, outstanding receivables, and near renewals.
   - A full record is written to the history.
4. What deliberately does NOT happen: payments are untouched, the total amount is not zeroed, the balance is not auto-cleared, and the case is not deleted — it stays in search, the customer's history, and reports. If money must be returned, the manager adjusts or deletes it manually, and both are recorded.
5. A cancelled case can be **restored** by the manager: status back to "In Progress", path open, cancelled period active again. This is recorded too.

> Without a mandatory reason, a cancellation is a meaningless number. With reasons, the manager can see that of 20 cancelled cases 14 were "documents not provided" — the problem is in document intake, not sales.

## D-4 — Birthday greeting

Fully automatic, once a year per customer. No employee touches it.

1. The manager turns on the **global switch** in settings, sets the send hour (default 10:00), and edits the two message templates (natural person, and founding anniversary for a legal entity) with placeholders like `{customer_name}` and `{institute_name}`.
2. Each customer has a "send greeting" checkbox (default on) and a birth/founding date. Both live on the **customer**, not the case — so a customer with three cases still gets exactly one greeting.
3. Once a day, at the settings hour, the automatic engine finds customers where: the global switch is on, the customer's checkbox is on, the customer has a birth date, the birth day+month matches today, and the customer is active.
4. For each match, it renders the correct template (natural vs. legal), substitutes the placeholders, and queues an SMS. The SMS-queue step dispatches it via the configured gateway.
5. A uniqueness constraint on the tuple **(customer, year)** in the database guarantees each customer is greeted only once per year, even if the engine runs many times that day.

**Edge cases:**
- Inactive customer → no greeting.
- Customer with no active case → greeting is still sent (an old customer is still a customer).
- Birth date 30 Esfand in a non-leap year → send on 29 Esfand.
- Two customers sharing one mobile number → each gets their own greeting; no merging.

> This flow is the clearest expression of the product's first promise — **the system does not forget** — and of two founding rules: no hardcoded text (templates from settings) and the "only once" guarantee living in the database, not the code.


