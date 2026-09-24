# What the Manager Defines Himself (Section B)

> Source: section B. Each row is something that **must not be hardcoded**.

## B-0 — Complete list of definable items

| Item | Where it is defined | Notes |
|------|---------------------|-------|
| Services | Services page | name, category, description, renewable flag, status |
| Service categories | Settings | a heading list such as "Registration", "Tax", "Insurance" |
| Each service's initial-registration path | Services page, inside that service | an ordered list of stages |
| Each service's renewal path | Services page, inside that service | an ordered list, independent of the initial path |
| Each service's validity durations | Services page, inside that service | "1 year", "2 years", etc. with a month count |
| Each service's reminder rules | Services page, inside that service | how many days before, via which channel, to whom |
| Case cancellation reasons | Settings | a heading list the manager writes |
| Follow-up results | Settings | options the employee picks after a call |
| Payment methods | Settings | cash, card-to-card, cheque, etc. |
| Departments | Settings | for grouping employees |
| Task-archive threshold | Settings | number of days |
| Renewal-abandonment threshold | Settings | number of days |
| Stale-case threshold | Settings | number of days — currently fixed at 10 |
| Birthday greeting | Settings | on/off, message text, send hour |
| Institute information | Settings | name, phone, address, email |
| SMS text templates | Settings | text with replaceable placeholders |
| SMS gateway | Settings | provider selection, key, sender number, real-send key |
| Each employee's permissions | Employees page | exception relative to the role default |

> The table of **deliberately-fixed** items (case/stage/period statuses, roles, priorities, customer types) is in [03-principles.md](03-principles.md).

## B-1 — Services (Status: Implemented)

Each service is a definition from which later cases are built. The most-used settings page in the system.

**Service form fields:**

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Service name | Yes | 2–80 chars, unique | "A service with this name exists." |
| Category | Yes | pick from the settings category list | — |
| Description | No | up to 500 chars | — |
| Renewable | — | yes / no | — |
| Status | — | active / inactive | — |

- If **"Renewable" is off**, the validity-durations, reminder-rules, and renewal-path sections are not shown at all, and this service's cases get no expiry date and no periods. **Company registration** is of this kind.
- **Deactivating:** the service is removed from the pick list in the case-registration form, but its existing cases stay untouched. If the path changes, only future cases are affected.
- **Deleting:** only when no case has ever been built from this service. Otherwise the button is disabled with "This service has 12 cases and cannot be deleted; you can deactivate it."

## B-2 — Each service's path (the most precise part of the document — Implemented)

The manager writes the path on the "service". At the moment a case is registered, the system builds a **copy** of that path onto that case.

- Inside the service form there are two separate sections: "initial-registration path" and "renewal path" (the second appears only when the service is renewable).
- Next to each stage there are three buttons: move up, move down, delete. The order is exactly what is shown in the list.

**Fields of each stage:**

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Stage title | Yes | 2–120 chars |
| Order | Automatic | read from the stage's position in the list, not from a manual number |

- A stage has nothing else — no assignee, no deadline, no cost. Kept deliberately simple. If a stage needs a follow-up with a date, a "task" is created.
- **Why copy, not reference?** If a case path were a reference to the service list, changing the service path would change the stages of old cases and make their history meaningless. With a copy, old cases stay untouched and only new cases get the new path.

**States that must be handled:**

| State | Correct behavior |
|-------|------------------|
| Service has no stages | Case is created with no path. Path card is not shown. No error. |
| Service is renewable but renewal path is empty | Renewal is recorded with no path; only date and amount. Valid. |
| Manager adds a stage to the service mid-work | Only future cases. No existing case changes. |
| Cancelled case | Its path is locked; no button on the stages works. |

**Adding an exceptional stage to a specific case (Status: Design):**
- An "Add stage" button at the bottom of the stage list on the case page, only for someone with edit permission.
- The added stage goes to the end of the path and can be reordered. It is only on this case and is not added to the service definition.
- A stage not yet started can be deleted; a stage with an action already recorded can only become "Not Needed".
- Adding and deleting a stage is recorded in the case history.

## B-3 — Validity durations (Status: Implemented)

For renewable services, the manager sets how many validity models the service has. The expiry date is computed from this.

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Title | Yes | free text such as "1 year", "6 months", "5 years" |
| Month count | Yes | integer between 1 and 120 |
| Default | — | only one of a service's durations can be the default |

**Expiry-date computation rule (critical):**
- Computed with the **Jalali (Shamsi) calendar**, not by adding days. "1 year" means the same day and month, next year. 1405/07/01 becomes 1406/07/01 — not 365 days later.
- **Clamping:** if the target day does not exist in the target month (e.g. 1 Farvardin (31st) + 6 months = 31 Mehr, which does not exist because Mehr has 30 days), clamp to the last day of that month. This case must be tested.

| State | Correct behavior |
|-------|------------------|
| A duration used in some case | Cannot be deleted. Only its title can be edited. |
| Service renewable but has no duration | Case-registration form must block Save: "No validity duration is defined for this service." |

## B-4 — Reminder rules (Status: Implemented)

For each service the manager sets when, via which channel, and to whom a reminder goes. The automatic engine works off these.

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Days before expiry | Yes | integer. Positive = before expiry, zero = expiry day, negative = after expiry |
| Send channel | Yes | internal notification / SMS to customer |
| Recipient | Yes | case owner / all managers / customer |
| Active | — | yes / no (to temporarily switch off a rule) |

**Example rule set for a business card:** 30 days before → internal notification to owner; 15 days before → notification to owner and managers; 7 days before → SMS to customer; expiry day → SMS to customer; 5 days after → notification to managers.

**Two critical rules that must be implemented precisely:**
1. The due condition is **"less than or equal to"**, not "equal to". If a rule is 7-days-before and the engine does not run that day, the next day (6 days left) it still sends. If the condition were "equal", one missed day would lose that reminder forever.
2. Each rule is sent **only once per period**. This guarantee must live in the database itself — a uniqueness constraint on the tuple (period, rule, send channel) — not checked in code.

## B-5 — Case cancellation reasons (Status: Design)

When a case is cancelled, why must be known. The reason list belongs to the manager, so it must be built entirely from settings.

- Path: Settings → "Case cancellation reasons".
- Each reason is just a short title. Next to it: edit title, move up, move down, deactivate. Full delete only when no case has used that reason.

| Field | Required? | Accepted value | Error |
|-------|-----------|----------------|-------|
| Reason title | Yes | 2–60 chars, unique | "A reason with this title exists." |
| Active | — | yes / no | — |
| Order | Automatic | from the reason's position in the list | — |

**Seven default reasons at first install** (the manager may change/delete/add): Customer withdrawal · Documents not provided · Rejected by the authority · Wrong or duplicate registration · Customer's financial problem · Transferred to another institute · Other.

- **Deactivated reason:** no longer appears in later selections but stays on earlier cases.
- **Editing a reason title:** because a reason is a shared record, not copied text, the new title shows on all earlier cases too.
- **Empty state:** the cancel dialog opens but the confirm button is disabled, with "No cancellation reason is defined yet. Add one from settings." plus a direct link to settings.
- **Why it matters:** without a reason, a cancellation is just a meaningless number. If the manager sees that of 20 cancelled cases, 14 were "documents not provided", the problem is not in sales — it is in the document-intake process.

## B-6 — Follow-up results (Status: Design)

When an employee does a task, they pick the result from a list. Same structure as cancellation reasons (add, edit, reorder, deactivate) — **with one important exception.**

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Result title | Yes | 2–60 chars, unique |
| Effect on renewal | No | none / agrees to renew / not interested |
| Active | — | yes / no |
| Order | Automatic | from the result's position in the list |

**Exception — "Effect on renewal" field:** two results have a side effect. When "agrees to renew" is recorded, that case's renewal follow-up status changes automatically; "not interested" causes that period to go to abandoned with no waiting. **This effect must not be tied to the title text** (the manager may change the title); the system looks at the "effect" field, not the text.

**Default results at install:** Customer answered (none) · Did not answer (none) · Call again (none) · Documents received (none) · Documents incomplete (none) · Agrees to renew (agrees to renew) · Not interested in renewal (not interested) · Other (none).

## B-7 — Payment methods, categories, and departments (Status: Design)

Three small lists with the same logic (manager defines, system uses):
- **Payment methods** — Settings → "Payment methods". Initial values: cash · card-to-card · bank transfer · cheque · POS terminal · other.
- **Service categories** — Settings → "Service categories". Initial values: registration · tax · insurance · trade · permits.
- **Departments** — Settings → "Departments". For grouping employees on the employees page and the workload table.

For all three: same rule as cancellation reasons — an item that has been used is not deleted, only deactivated.

## B-8 — Time thresholds (Status: Design)

Three numbers that determine the system's automatic behavior. All three must be changeable in settings.

| Setting | Default | Allowed range | What it does |
|---------|---------|---------------|--------------|
| Auto-archive of completed tasks | 7 days | 1–365 | a finished task, after this span, moves from the daily-tasks tab to the archive tab |
| Move expired renewal to abandoned | 30 days | 1–365 | a period this many days past its expiry, not renewed, becomes abandoned |
| Stale case | 10 days | 1–180 | a case whose stage has not moved for this span is counted in the "stale cases" dashboard indicator |

**Threshold-change rules:**
- The change takes effect from the moment of save and applies on the engine's next run.
- Lowering a threshold does not bring back what was already moved. If the manager raises the abandonment threshold from 30 to 60, renewals already abandoned do not return on their own — they must be restored manually.
- **Zero is not allowed.** A zero threshold means a task vanishes the instant it is completed, which is confusing.
- Under each number there must be a sentence explaining exactly what happens, not just the setting's name.

## B-9 — Birthday greeting (Status: Design)

Three configuration places: a global switch, a per-customer checkbox, and a text template.

**Global settings:**

| Setting | Default | Notes |
|---------|---------|-------|
| Send birthday greeting | Off | master switch. Until it is on, no greeting is sent, even if the customer's checkbox is on. |
| Send hour | 10:00 | the hour of day the engine sends greetings. A number between 0 and 23. |
| Birthday message template (natural person) | default text | with placeholders for customer name and institute name |
| Founding-anniversary template (legal entity) | default text | with placeholders for company name and institute name |

**Per-customer checkbox:** each customer has a "send birthday greeting" checkbox that defaults to on. It is seen and changed in two places: the customer form and the case-registration form.

> **Important decision:** the checkbox and birth date are stored on the **customer**, not on the case. If they were on the case, a customer who bought three services would get three texts on their birthday. The case-registration form is just another way to fill that same customer field.

**Send rule:** the engine runs once a day at the settings hour; it finds customers where the global switch is on, their own checkbox is on, they have a birth date, their birth day+month matches today, and they are active. Each customer gets a greeting **only once per year** — a uniqueness constraint on the tuple (customer, year) in the database.

| State | Correct behavior |
|-------|------------------|
| Inactive customer | No greeting is sent |
| Customer has no active case | Greeting is sent (an old customer is still a customer) |
| Birth date is 30 Esfand in a non-leap year | Send on 29 Esfand |
| Two customers with one mobile number | Each gets their own greeting; no merging needed |

## B-10 — Institute information, SMS templates, SMS gateway (Status: Design)

Three related settings groups that feed the SMS and identity of the system. All are manager-defined; none may be hardcoded.

### Institute information

| Field | Required? | Accepted value |
|-------|-----------|----------------|
| Institute name | Yes | 2–120 chars |
| Phone | Yes | valid phone number |
| Address | No | up to 300 chars |
| Email | No | valid email format |

- These values are used as placeholders inside SMS templates (e.g. `{institute_name}`) and shown on printed/exported documents. Changing them updates every future message; already-sent messages are historical and unchanged.

### SMS text templates

The manager writes each message text once, with **replaceable placeholders**. No SMS body is ever hardcoded in the source.

| Rule | Detail |
|------|--------|
| Placeholders | written like `{customer_name}`, `{service_name}`, `{expiry_date}`, `{institute_name}`, `{amount}` — the engine substitutes real values at send time |
| Per-event template | there is one editable template per SMS event (renewal reminder, birthday greeting, founding anniversary, etc.) |
| Unknown placeholder | if a template contains a placeholder the system does not recognize, it is left as-is and flagged, never crashes the send |
| Empty template | if a required template is empty, the corresponding SMS event is skipped and logged; the engine does not send blank messages |

> **Why placeholders, not fixed text:** the manager must be able to reword any message from settings without a developer. This is a direct application of Principle 1 — [03-principles.md](03-principles.md).

### SMS gateway

| Field | Required? | Accepted value | Notes |
|-------|-----------|----------------|-------|
| Provider | Yes | pick from supported provider list | selecting the provider decides which API adapter is used |
| API key | Yes | provider-issued key | treated as a secret; not echoed back in plain text once saved |
| Sender number | Yes | the line the SMS is sent from | |
| Real-send key | — | on / off (or a confirmation token) | a safety switch: while off, messages are queued/logged but not actually dispatched, so testing does not send real SMS |

- The gateway settings are read by the automatic engine's SMS-queue step; if the gateway is misconfigured, the queue item stays pending and is retried, rather than being lost.
- The **real-send key** exists so the institute can verify the whole pipeline (templates, placeholders, recipients) in a safe mode before switching to live sending.





