# Pages, Field by Field (Section C)

> Source: section C. Each page with its fields, rules, buttons, and empty/error states.

## C-1 — Login (Status: Implemented — institute name must be fixed)

The only page seen without logging in.

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Mobile number | Yes | 11 digits, starts with 09 | "The mobile number is not valid." |
| Password | Yes | at least 8 chars | "Enter your password." |

**Rules:**
- If the number or password is wrong, the message is only "The mobile number or password is incorrect" — not "this number is not registered". (Distinguishing the two tells an attacker which numbers exist in the system.)
- After 5 consecutive failed attempts from one number, lock for 15 minutes.
- A session is valid for 12 hours, after which the user is logged out.
- An inactive user cannot log in; if deactivated mid-work, their next request is rejected.
- No one can create their own account. Accounts are created only from the employees page.
- After login, the manager and supervisor go to the management dashboard, the employee to their own panel.
- The institute name on this page must be read from settings (currently hardcoded).

## C-2 — Management dashboard (Status: Implemented — abandoned indicator must be added)

The page the manager opens first thing in the morning. No number is decorative; for each one it must be clear where it comes from.

**Top-of-page indicators:**

| Indicator | Computed from | Where a click goes |
|-----------|---------------|--------------------|
| Active cases | count of cases whose status is "New" or "In Progress" | case list with the same filter |
| Today's tasks | count of open tasks due today | "Today" tab of the tasks page |
| Overdue tasks | count of open tasks past their due date | "Overdue" tab of the tasks page |
| Near renewals | count of active periods expiring within the next 30 days, minus abandoned ones | renewals page |
| Outstanding receivables | sum of the balance of all active cases with a positive balance | case list filtered "has balance" |
| Stale cases | count of active cases whose stage has not moved for more than the settings threshold | case list with the same filter |
| Abandoned renewals | count of abandoned periods | "Abandoned" tab of the renewals page |

**Bottom-of-page tables:**

| Table | Columns | Row buttons |
|-------|---------|-------------|
| Near renewals | customer · service · owner · expiry date · days remaining · financial balance · follow-up status | follow up · register renewal |
| Today's tasks | task title · customer · case number · owner · priority | record result |
| Employee status | employee · department · active cases · today's tasks · overdue tasks | — |

> **Mandatory note:** below the employee-status table it must say: "This table is for workload control, not performance evaluation." Without this sentence, the table becomes a pressure tool in practice.

**Empty states:** "There are no near renewals." / "No task is registered for today." (with a register-task button) / if the system is freshly installed: a short three-step guide (define a service, register a customer, register a case).

## C-3 — Customers (Status: Implemented — birth date and greeting checkbox must be added)

The customer list, the registration form, and each customer's own page. The first choice is the customer type, and the rest of the form changes with it.

**Customer create/edit form:**

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Customer type | Yes | natural / legal | — |
| Full name (natural) | Yes | 2–100 chars | "Enter the name." |
| Company name (legal) | Yes | 2–150 chars | "Enter the company name." |
| Mobile number | Yes | 11 digits with 09, unique system-wide | "This number is already registered: <customer name>" |
| National ID (natural) | No | 10 digits with control-digit validation | "The national ID is not valid." |
| National entity ID (legal) | No | 11 digits | "The national entity ID must be 11 digits." |
| Registration number (legal) | No | up to 20 chars | — |
| Birth date (natural) | No | Jalali date, must not be in the future | "The birth date cannot be in the future." |
| Founding date (legal) | No | Jalali date, must not be in the future | same |
| Send greeting message | — | on / off (default on) | — |
| Landline | No | up to 15 digits | — |
| City | No | text | — |
| Address | No | up to 500 chars | — |
| Notes | No | up to 1000 chars | — |
| Customer code | Automatic | e.g. CU-1405-0013 — unique and immutable | — |

> The greeting checkbox is only meaningful when the birth date is filled. If the date is empty, show the checkbox disabled and dimmed with "Enter the birth date to enable this."

**Customer list:**
- Columns: code · name · type · mobile · city · active-case count · status.
- Search on: name, mobile, national ID, national entity ID, customer code.
- Filters: customer type · status (active/inactive) · city.
- Sort: newest (default) · name · case count.
- Pagination: server-side, 25 rows per page.

**Each customer's own page:**
- Top card: contact info, type, national ID / entity ID, birth date and greeting-checkbox state.
- List of this customer's cases with status, current stage, path progress, and each one's financial balance.
- Grand total of the balance across all cases.
- Timeline of follow-ups of all calls, newest first.
- A "Register new case" button that opens pre-filled with this customer.

**Deletion and deactivation:**

| State | Correct behavior |
|-------|------------------|
| Customer has no case | Full delete allowed, with confirmation |
| Customer has cases | Delete button disabled with "This customer has 3 cases." Only deactivation |
| Inactive customer | Does not appear in the case-registration pick list, but its page and history stay untouched |

## C-4 — Case registration (Status: Implemented — two birth fields must be added)

The most important form in the system. Anything registered wrong here stays with the case for the rest of its life.

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Customer | Yes | pick from active customers, with search | "Select the customer." |
| Customer birth date | No | shown only when the picked customer has no birth date | same rules as the customer form |
| Send greeting message | — | on/off — the customer's current value | — |
| Service | Yes | pick from active services | "Select the service." |
| Validity duration | Yes if the service is renewable | list of that service's durations; default auto-selected | "Select the validity duration." |
| Start date | Yes | Jalali date | "Enter the start date." |
| Expiry date | Computed | automatic from start date and duration — not manually editable | — |
| Total amount | No | integer Toman, between 0 and 2 billion | "The amount is not valid." |
| Case owner | Yes | pick from active employees (only someone allowed) | "Select the owner." |
| Notes | No | up to 1000 chars | — |
| Case number | Automatic | e.g. PR-1405-0284 — restarts from 1 each Jalali year | — |

**Live form behavior:**
1. As soon as a customer is picked: if they have no birth date, the two birth fields appear. If they have one, display-only with a small edit button.
2. As soon as a service is picked: the durations list loads and the default is selected. If the service is not renewable, the duration and expiry-date section is hidden entirely.
3. As soon as a start date is entered or the duration changes: the expiry date is recomputed and shown.
4. Below the service pick, the number of path stages is shown: "This service has 7 stages."
5. The Save button is disabled until all required fields are filled, and stays disabled after being pressed until the operation finishes (so it is not submitted twice).

**What happens with one press of Save (a single transaction):**
1. The case is created and gets its number.
2. If a birth date was entered in the form, it is saved on the customer record — not on the case.
3. The stages of that service's initial-registration path are copied and the first stage becomes "In Progress".
4. If the service is renewable, the first period is created with the start and expiry dates.
5. The case owner gets a notification.
6. The record is written to the activity history.
7. The user is taken directly to that case's page.

> All these steps must be one single operation. If creating the stages fails, the case must not be created either.

## C-5 — Case page, overall structure (Status: Implemented)

Where the user spends the most time. At a glance it must answer three things: where we are on the path, how much money we have received, what to do next.

**Page header:** case number · customer name (link) · service name · colored status badge · start and expiry dates · days remaining · case owner with change option · top buttons: edit case, register new task, cancel case.

**Two main cards side by side:**
- **Path:** on the first period "Initial-registration path"; on a renewal period "Renewal path — Period N". Its content is about the current period.
- **Financial status:** always the same title; its content is about the current period.

**Bottom tabs:** stages (current path) · tasks (open and closed) · periods & renewal (a card per period, newest first) · payments (with a "for which period" column) · history (all events).

> **The "current path" rule:** the path card always shows the path of the active period. Earlier periods' paths are visible in the "periods" tab but do not clutter the main page.

## C-6 — Path card, exact behavior (Status: Implemented)

**Display:** a horizontal bar of circles in stage order (horizontally scrollable if many, not wrapped). Colors: done = solid green · current = with a ring · rejected = red · "not needed" = grey struck-through · rest = dim grey. Below the bar: "Current stage: <title> — <done> of <total> stages · <percent>%". Below that, a vertical list of stages: number, title, status badge, start date, end date, last changer's name, attempt counter (if more than one), note.

**Buttons:**

| Button | When it is shown | Exactly what it does |
|--------|------------------|----------------------|
| Start | stage is "Pending" | status → "In Progress" + record start time |
| Done | stage is open | status → "Done" + record end time + next stage auto "In Progress" + update the case's "current stage" |
| Reject | stage is open | status → "Rejected" + attempt counter +1 + stage stays open + path does not advance + note mandatory |
| Not needed | stage is open | status → "Not Needed" + like Done, advances the path + counts as passed in the progress percentage |
| Reopen | stage is closed | status back to "In Progress" + end time cleared |
| Note | always | a small dialog to write/edit that stage's note |

> "Rejected" is a normal status, not an error (company-name approval is rejected, an examiner finds a deficiency). The stage stays open so it can be attempted again. The attempt counter is a report: a stage whose average attempts is 3 has a problem somewhere.

**Side effects of every stage change:**
1. The case's "current stage" field updates to the first open stage. If no open stage remains, its value becomes "all stages done".
2. The case's last-activity time updates (the same value "stale case" is computed from).
3. If the case status was "New", it changes to "In Progress".
4. A record is written to the history.

**States that must be blocked:** cancelled case (all buttons disabled with "The case is cancelled.") · an employee who is not this case's owner and lacks permission to edit others' (must not see the buttons at all) · a direct server request for a stage the user is not allowed to touch (must be rejected).

## C-7 — Financial-status card, exact behavior (Status: Implemented)

Money must be on the case page itself, not in a separate ledger.

| Value | Stored or computed? | Explanation |
|-------|---------------------|-------------|
| Total amount | Stored | the amount agreed with the customer for this period. May be empty. |
| Each payment | Stored | date, amount, method, for-which, note, recorder |
| Paid | Computed | sum of that period's payment amounts |
| Balance | Computed | total minus paid. If total is empty, balance shows "—", not zero |
| Payment percentage | Computed | paid divided by total |
| Status label | Computed | unpaid · prepayment received · settled · overpaid |

> None of the "computed" rows may be stored in the database.

**Payment-record form:**

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Amount | Yes | integer Toman, greater than zero, up to 2 billion | "The amount must be greater than zero." |
| Receipt date | Yes | Jalali date, must not be in the future | "The receipt date cannot be in the future." |
| Payment method | Yes | from the settings method list | "Select the payment method." |
| For which | Yes if the case has more than one period | the first period or one of the renewal periods | "Specify which period this amount is for." |
| Note | No | up to 300 chars | — |

**Buttons:** record receipt (new payment; balance and label update immediately) · adjust total amount (only that period's total; payments untouched) · delete payment (with confirmation; recorded in history).

**Rules:** the currency is Toman and always an integer (no decimals) · shown with a 3-digit separator and Persian digits like ۷٬۵۰۰٬۰۰۰ · if the sum of payments exceeds the total, the balance goes negative and the label is "overpaid" in the warning color (not blocked; it genuinely happens) · viewing financial info and recording/deleting payments are two separate permissions · this section is not accounting (official invoices, tax, and legal ledgers are outside the system).

## C-8 — Case cancellation (Status: Design — reason must be added)

Cancellation is a normal event but must not be silent.

**Cancel dialog:** top warning ("This case has 3 open stages, 2 open tasks, and 4,500,000 Toman balance.") · cancellation reason (dropdown of active reasons, mandatory) · note (up to 500 chars, optional) · confirm button (disabled until a reason is picked).

**On confirm, these happen together (one transaction):**
1. Case status → "Cancelled" + record cancellation date, reason, note, and canceller's name.
2. The case path is locked; open stages stay open so it is clear where it stopped.
3. The active period is cancelled so no reminder or SMS is issued.
4. All open tasks of this case are cancelled and their owners get a notification.
5. The case leaves the counts of active cases, outstanding receivables, and near renewals.
6. A full record is written to the history.

**What deliberately does NOT happen:** payments are untouched · the total amount is not zeroed and the balance is not auto-cleared (if money must be returned, the manager adjusts or deletes it manually — both are recorded) · the case is not deleted and stays in search, the customer's history, and reports.

**Restoring from cancellation:** a "Restore case" button on the cancelled case's page, for the manager only. On confirm: status → "In Progress", path open, cancelled period active again. This action is also recorded in history.

**Report:** a simple report is needed: within a chosen period, how many cases were cancelled and how many per reason. Without this report, recording the reason is just an extra field.

## C-9 — Periods & renewal (Status: Implemented)

A renewal is not a separate entity; it is the next period of the same case.

**Each period card:** title ("Period 1 (Registration)" or "Renewal 1") · period status badge (Active · Renewed · Cancelled · Abandoned) · follow-up status badge (Not followed up · Contacted · Awaiting customer · Agrees to renew · Not interested) · span (from date to date) · three financial numbers (amount · paid · balance) · that period's path progress bar ("3/5") · last follow-up (employee name, date, note) · the active period in a distinct color.

**Renewal-record form:**

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| New period start date | Yes | default: the previous period's end date |
| Validity duration | Yes | from that service's durations |
| New expiry date | Computed | automatic |
| Renewal amount | No | integer Toman |
| Note | No | up to 300 chars |

**On registering a renewal (one transaction):** the previous period is closed and becomes "Renewed" · the new period is created with the next number · the case's expiry date updates to the new period's expiry date · the service's "renewal path" stages are copied and tied to the new period, and the first stage becomes "In Progress" · the path-card title changes to "Renewal path — Period N" · the reminder cycle for the new period starts fresh.

**Renewal-follow-up form:** follow-up status (from the renewal-status list, mandatory) · note (up to 300 chars, no).

> **Note:** two things are deliberately kept apart: **expiry status** ("3 days left", which comes from the date and no one changes) and **follow-up status** ("not yet contacted", which comes from people's actions). Combining the two answers the question no spreadsheet answers: which renewal is near and still untouched?

## C-10 — Renewals page & abandoned tab (Status: Implemented — abandoned tab must be added)

This page is a work queue, not a list parallel to cases. Clicking any row takes the user to the case itself.

**Tabs:**

| Tab | What it shows |
|-----|---------------|
| All | all active periods expiring within the next 90 days or already expired |
| Urgent | up to 7 days left |
| Near | between 8 and 30 days left |
| Expired | past expiry but not yet at the abandonment threshold |
| No follow-up | up to 30 days left and follow-up status still "Not followed up" |
| Abandoned | periods that have passed the threshold |

**Table columns:** case number · customer · service · owner · expiry date · days remaining · follow-up status · amount · balance · buttons.

**Abandonment rule (exact):**
1. Condition: the period is active, its expiry date has passed, more than the settings threshold in days has passed since expiry, and it is not yet renewed.
2. Exception: if the follow-up status is "Not interested", it goes straight to abandoned without waiting for the threshold.
3. The transition is done by the same automatic engine, each time it runs.
4. On abandonment: removed from the main tabs, subtracted from the dashboard's "near renewals" count, and no more reminders or SMS are sent.
5. In the abandoned tab, each row shows how many days past expiry it is and when the last follow-up was.

**Restoring:** a "Return to follow-up" button on each abandoned-tab row. The period becomes "Active" again, returns to the main tabs, and its reminders resume. Recorded in history.

> **Why reminders stop for the abandoned:** sending "your business card has expired" to someone 90 days past expiry who has ignored two calls is both a wasted cost and a hit to the institute's reputation.

## C-11 — Tasks, follow-ups, and archive (Status: Implemented — archive and delete must be added)

**Task-record form:**

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Task title | Yes | 2–150 chars |
| Related case | No | pick from active cases; pre-filled if created from inside a case |
| Owner | Yes | active employee — default the current user |
| Due date | Yes | Jalali date |
| Priority | Yes | Normal / High / Urgent — default Normal |
| Note | No | up to 500 chars |

**Tasks-page tabs:** all tasks (open, not archived) · today · overdue · my tasks · assigned (to others) · completed (not yet archived) · archive.

**Recording a result:** result (from the settings follow-up-results list, mandatory) · note (up to 500 chars, no) · next task (a "create a follow-up task" checkbox with a date, for when the result is "Call again").

**On recording a result (one transaction):** the task is closed and becomes "Completed" · a follow-up record is created and added to the case timeline · if the chosen result has an "effect on renewal" field, the active period's follow-up status of that case changes automatically (the employee need not record it in two places) · if the "next task" checkbox is ticked, a new task is created with the same owner and the chosen date · the case's last-activity time updates.

**Auto-archive:** a task whose status is "Completed" or "Cancelled", after the settings threshold has passed since its close date, is archived by the same automatic engine. It leaves the daily tabs and is seen only in the "Archive" tab. It stays in place in the case timeline, is counted in the performance report, and is found in search. A "Manual archive" button and an "Unarchive" button are also needed.

**Task deletion:**

| State | Correct behavior |
|-------|------------------|
| Task has no follow-up result | Full delete allowed, by the manager only, with confirmation |
| Task has a follow-up result | Delete button disabled with "This task has a recorded follow-up and can only be archived." |

**Other rules:** "overdue" is computed (no one changes it by hand) · a regular employee cannot edit or reassign others' tasks · a task is not assigned to an inactive employee · a follow-up result is not deleted (if recorded wrong, a new result is recorded and both stay in the timeline).

## C-12 — Employees and permissions (Status: Implemented)

The most important part of this page is what happens when an employee leaves.

**Employee form:**

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Full name | Yes | 2–100 chars |
| Mobile number | Yes | 11 digits, unique — this is the username |
| Email | No | valid email format |
| Department | No | from the settings list |
| Role | Yes | Manager / Supervisor / Employee |
| Initial password | Yes at creation | at least 8 chars |
| Status | — | active / inactive |

**Permissions page:** for each employee, a list of modules with their fine-grained permissions. Under each permission the role default is written, plus a toggle for the exception:

| Module | Permissions |
|--------|-------------|
| Customers | view · create · edit · deactivate |
| Cases | view all · view own cases · create · edit · assign owner · cancel · restore |
| Stages | advance a stage · add an exceptional stage |
| Financial | view financial info · record and delete receipts · adjust total amount |
| Tasks | view all · view own tasks · create · assign to others · record result · archive · delete |
| Renewals | view · record follow-up · register renewal · restore from abandoned |
| Services | view · edit |
| Employees | view · create · edit · change permissions |
| Settings | view · edit |
| Reports | view |

**Deactivating an employee:**
1. The manager clicks "Deactivate".
2. If that employee has any active case or open task, the system blocks the operation: "This employee has 7 active cases and 4 open tasks. Specify a new owner."
3. The manager picks a successor.
4. All active cases and open tasks are transferred to the successor in one operation.
5. The successor gets a notification with the count of transferred items.
6. The employee is deactivated and cannot log in from that moment.

**Rules:** an employee is never deleted, only deactivated (their name stays in history) · no one can deactivate their own account · the last active manager of the system cannot be deactivated · password change: the manager can only set a new password, not see the current one.

## C-13 — Settings page structure (new sections: Design)

Everything from section B on one sectioned page (not one long form): institute information · service categories · departments · case cancellation reasons · follow-up results (with the "effect on renewal" field) · payment methods · time thresholds · birthday greeting · SMS templates (with preview) · SMS gateway · SMS status (count sent, queued, failed, with error details).

**Shared pattern for all editable lists** (cancellation reasons, follow-up results, payment methods, categories, departments):
- A list with an "Add" button above it.
- Each row: title editable in place, move-up button, move-down button, active/inactive toggle, delete button.
- The delete button is enabled only when that item is used nowhere; otherwise it is disabled with "This item is used in 14 cases".
- A duplicate title is not accepted.
- Empty list: "No item is defined yet." with an add button.
- Saving must be immediate, not via one Save button at the bottom of the whole page.

## C-14 — Automatic engine (Status: reminders Implemented — three new tasks must be added)

A part with no page of its own that holds the product's most important promise.

| Task | How often | What it does |
|------|-----------|--------------|
| Send renewal reminders | every 6 hours | checks service reminder rules and issues the due SMS/notification |
| Overdue-task alerts | every 6 hours | for an employee with 3 or more overdue tasks, alerts the manager |
| Unfollowed-renewal alert | every 6 hours | a renewal with up to 7 days left and not yet followed up |
| Task archiving | every 6 hours | archives closed tasks past the threshold |
| Renewal abandonment | every 6 hours | makes expired periods past the threshold abandoned |
| Send birthday greetings | once a day, at the settings hour | for customers whose birthday is today and whose checkbox is on |
| SMS-queue processing | every 6 hours | sends queued SMS to the gateway and records the result |

**Critical engine rules:**
- Each reminder for each period, only once. Guaranteed in the database.
- Each birthday greeting for each customer, once per year. Guaranteed in the database.
- If the engine does not run one day, no reminder is lost; the next run makes up for it (the "less than or equal to" condition).
- Managerial alerts have a 24-hour anti-repeat so the manager is not bombarded.
- Nothing is sent for abandoned periods or cancelled cases.
- Each engine run must be logged: when, how many reminders, how many archives, how many abandonments, how many errors.

> **Install note:** this is the only part of the system that needs an external setting (a Windows/server scheduler — cron). Without it, no SMS, no greeting, and no automatic archiving happen. This must be written prominently in the install documentation.

## C-15 — Employee panel (Status: Design — pages not built)

The same system from the employee's view. **There is no new data; only the same data with a filter.** The rule for building this panel is one sentence: every page is the same as the manager's pages, with one extra condition that returns only records belonging to the user themselves. No new query, logic, or component should be built.

| Page | Difference from the manager panel |
|------|-----------------------------------|
| Dashboard | only their own tasks, cases, and renewals. No employee-status table |
| My cases | only cases they own |
| Tasks | only their own tasks |
| Renewals | only renewals of their own cases |
| Customers | only customers related to their own cases |
| Employees, Settings, Services | do not exist at all |

**Rules:** viewing financial info and recording receipts are two separate permissions, and the manager decides for each employee individually · when the manager assigns a case to an employee, they get a notification at that moment and the case appears in their list (nothing is copied) · one database, two views; every employee action is immediately visible in the manager panel.

## C-16 — Global search (Status: Implemented)

A search bar at the top of every page.
- Search on: customer name, company name, mobile number, national ID, national entity ID, customer code, case number, service name.
- Categorized results: customers, cases.
- Cancelled cases and abandoned renewals are also found, with their status badge (they are records, not trash).
- Search respects permissions: each person finds only what they are allowed to see.
- If nothing is found: "No item found" with a suggestion to search differently, not a blank page.






