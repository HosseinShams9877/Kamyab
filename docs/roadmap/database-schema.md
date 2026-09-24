# Database Schema

> Tables, fields, and relationships for the Kamyab operations system, expressed model-first (maps directly to `prisma/schema.prisma`). Names follow the glossary ([02-glossary.md](../knowledge/02-glossary.md)) exactly. **No computed value has a column** — balance, paid, percentages, days-remaining, overdue, progress, and dashboard counts are derived at read time ([07-critical-rules.md](../knowledge/07-critical-rules.md), rule 2). Required indexes are listed separately in [database-indexes.md](database-indexes.md).

## Fixed enums (deliberately not manager-editable)

| Enum | Values |
|------|--------|
| `Role` | MANAGER, SUPERVISOR, EMPLOYEE |
| `CustomerType` | NATURAL, LEGAL |
| `CaseStatus` | NEW, IN_PROGRESS, COMPLETED, CANCELLED |
| `StageStatus` | PENDING, IN_PROGRESS, DONE, REJECTED, NOT_NEEDED |
| `PeriodStatus` | ACTIVE, RENEWED, CANCELLED, ABANDONED |
| `FollowUpStatus` | NOT_FOLLOWED_UP, CONTACTED, AWAITING_CUSTOMER, AGREES_TO_RENEW, NOT_INTERESTED |
| `TaskPriority` | NORMAL, HIGH, URGENT |
| `TaskStatus` | OPEN, COMPLETED, CANCELLED |
| `PathType` | INITIAL, RENEWAL |
| `ReminderChannel` | INTERNAL_NOTIFICATION, SMS_TO_CUSTOMER |
| `ReminderRecipient` | CASE_OWNER, ALL_MANAGERS, CUSTOMER |
| `RenewalEffect` | NONE, AGREES_TO_RENEW, NOT_INTERESTED |

> The manager-editable lists (reasons, results, methods, categories, departments) are **tables**, not enums — that is the whole point of Principle 1. Only the values above are hardcoded, and only because the system's logic is built on them ([03-principles.md](../knowledge/03-principles.md)).

---

## People and access

### Employee
The system's user. Mobile number is the username.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| fullName | string | 2–100 |
| mobile | string | **unique**, 11 digits |
| email | string? | valid email |
| departmentId | FK → Department? | |
| role | Role | base role |
| passwordHash | string | bcrypt/argon2; never returned |
| status | boolean | active/inactive |
| createdAt / updatedAt | datetime | |

Relations: owns many `Case`, owns many `Task`, has many `PermissionException`, authored many history/follow-up rows.

### Department
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | unique |
| active | boolean | |
| order | int | manual ordering |

### PermissionException
Stores only the **differences** from the role default, never the whole permission set (per [01-summary.md](../knowledge/01-summary.md)).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| employeeId | FK → Employee | |
| permissionKey | string | e.g. `financial.record_payment` |
| allowed | boolean | the override value |

Unique on (employeeId, permissionKey).

## Customer

One customer, many cases. Birth date and greeting flag live **here**, not on the case (B-9).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| code | string | **unique**, immutable, e.g. CU-1405-0013 |
| type | CustomerType | NATURAL / LEGAL |
| fullName | string? | required when NATURAL (2–100) |
| companyName | string? | required when LEGAL (2–150) |
| mobile | string | **unique** system-wide, 11 digits |
| nationalId | string? | 10 digits, control-digit validated (natural) |
| nationalEntityId | string? | 11 digits (legal) |
| registrationNumber | string? | up to 20 (legal) |
| birthDate | date? | Jalali; not future (natural) |
| foundingDate | date? | Jalali; not future (legal) |
| sendGreeting | boolean | default true; meaningful only if a date exists |
| landline | string? | |
| city | string? | |
| address | string? | up to 500 |
| notes | string? | up to 1000 |
| status | boolean | active/inactive |
| createdAt / updatedAt | datetime | |

Relations: many `Case`, many `BirthdayLog`.

## Services and their definitions

### ServiceCategory
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | unique |
| active | boolean | |
| order | int | |

### Service
A definition, not a job. Renewable off → no durations/reminders/renewal-path.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| name | string | **unique**, 2–80 |
| categoryId | FK → ServiceCategory | |
| description | string? | up to 500 |
| renewable | boolean | |
| status | boolean | active/inactive |

Relations: many `ServicePathStage`, many `ServiceDuration`, many `ReminderRule`, many `Case`.

### ServicePathStage
The **template** stages that get copied onto a case/period (rule 9). Two ordered lists per service, keyed by `pathType`.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| serviceId | FK → Service | |
| pathType | PathType | INITIAL / RENEWAL |
| title | string | 2–120 |
| order | int | position in the list |

### ServiceDuration
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| serviceId | FK → Service | |
| title | string | free text ("1 year") |
| monthCount | int | 1–120 — expiry uses this via Jalali month-add (rule 10) |
| isDefault | boolean | at most one true per service |

### ReminderRule
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| serviceId | FK → Service | |
| daysBefore | int | positive=before, 0=expiry day, negative=after |
| channel | ReminderChannel | |
| recipient | ReminderRecipient | |
| active | boolean | |

## The core chain: Case → Period → CaseStage

### Case
A service sold to a customer.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| number | string | **unique**, e.g. PR-1405-0284, restarts per Jalali year |
| customerId | FK → Customer | |
| serviceId | FK → Service | which definition it came from |
| ownerId | FK → Employee | case owner |
| status | CaseStatus | NEW / IN_PROGRESS / COMPLETED / CANCELLED |
| notes | string? | up to 1000 |
| lastActivityAt | datetime | updated on every stage/task action — the basis for "stale case" |
| cancelledAt | datetime? | set on cancellation |
| cancellationReasonId | FK → CancellationReason? | mandatory when cancelled |
| cancellationNote | string? | up to 500 |
| cancelledById | FK → Employee? | |
| createdAt / updatedAt | datetime | |

Relations: many `Period`, many `Task`, many `FollowUp`, many `ActivityHistory`.

> **Not stored:** days-remaining, progress %, current-stage label, balance — all computed. `lastActivityAt` is a genuine event timestamp (not derived from other rows), so it is stored; the stale-case indicator compares it to today minus the threshold.

### Period
A validity span. Period 1 = registration; later periods = renewals. `totalAmount` lives here (each period has its own amount).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| caseId | FK → Case | |
| indexNumber | int | 1 = registration, 2+ = renewals |
| status | PeriodStatus | ACTIVE / RENEWED / CANCELLED / ABANDONED |
| startDate | date | Jalali |
| expiryDate | date? | Jalali; computed at creation, then stored as the period's fact; null for non-renewable services |
| totalAmount | bigint? | integer Toman; may be null → balance shows "—" |
| followUpStatus | FollowUpStatus | separate from expiry status |
| createdAt / updatedAt | datetime | |

Relations: many `CaseStage`, many `Payment`, many `SentReminder`.

> `expiryDate` is computed from `startDate` + duration's `monthCount` on the Jalali calendar **at creation time** and then persisted as that period's fixed fact — it is not recomputed on read and is not manually editable. The prohibition in rule 2 is about values derived from *other current rows* (balance, counts); a period's expiry is an immutable computed-once fact of that period, like its start date.

### CaseStage
A **copy** of a service path stage, bound to one period. Exceptional per-case stages also live here.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| periodId | FK → Period | |
| title | string | copied from the template (or typed for an exceptional stage) |
| order | int | position; reorderable |
| status | StageStatus | PENDING / IN_PROGRESS / DONE / REJECTED / NOT_NEEDED |
| startedAt | datetime? | set on Start |
| endedAt | datetime? | set on Done/Not-Needed; cleared on Reopen |
| attemptCount | int | +1 on each Reject |
| note | string? | mandatory when Rejected |
| isExceptional | boolean | true for a per-case added stage (not in the service definition) |
| lastChangedById | FK → Employee? | |

## Money

### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| periodId | FK → Period | "for which period" |
| amount | bigint | integer Toman, > 0 |
| receiptDate | date | Jalali; not future |
| methodId | FK → PaymentMethod | |
| note | string? | up to 300 |
| recordedById | FK → Employee | |
| createdAt | datetime | |

> paid, balance, payment %, and the status label are computed from a period's payments and its `totalAmount` — never stored.

### PaymentMethod
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | unique |
| active | boolean | |
| order | int | |

## Tasks and follow-ups

### Task
A personal to-do with a due date — distinct from a Stage.

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | 2–150 |
| caseId | FK → Case? | optional relation to a case |
| ownerId | FK → Employee | not an inactive employee |
| dueDate | date | Jalali |
| priority | TaskPriority | NORMAL / HIGH / URGENT |
| status | TaskStatus | OPEN / COMPLETED / CANCELLED |
| note | string? | up to 500 |
| closedAt | datetime? | when completed/cancelled — archive threshold counts from here |
| archivedAt | datetime? | set when archived (auto or manual) |
| createdById | FK → Employee | |
| createdAt / updatedAt | datetime | |

> "overdue" is computed (dueDate < today AND status = OPEN); "archived" is `archivedAt != null`.

### FollowUp
A result recorded after doing a task; sits in the case timeline. Immutable (never edited/deleted — a correction is a new row).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| taskId | FK → Task? | the task it closed, if any |
| caseId | FK → Case | for the timeline |
| periodId | FK → Period? | the period whose follow-up status it may affect |
| resultId | FK → FollowUpResult | |
| note | string? | up to 500 |
| createdById | FK → Employee | |
| createdAt | datetime | |

### FollowUpResult (manager-defined)
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | unique, 2–60 |
| effectOnRenewal | RenewalEffect | **the logic keys off this field, never the title** (B-6) |
| active | boolean | |
| order | int | |

### CancellationReason (manager-defined)
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| title | string | unique, 2–60 |
| active | boolean | |
| order | int | |

## Engine, messaging, settings, audit

### SentReminder
Enforces "each reminder once per period" in the database (rule 5).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| periodId | FK → Period | |
| ruleId | FK → ReminderRule | |
| channel | ReminderChannel | |
| sentAt | datetime | |

**Unique on (periodId, ruleId, channel).**

### BirthdayLog
Enforces "each customer greeted once per year" (rule 5).

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| customerId | FK → Customer | |
| year | int | Jalali year |
| sentAt | datetime | |

**Unique on (customerId, year).**

### SmsMessage (queue + log)
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| recipient | string | mobile |
| body | string | rendered from a template |
| templateKey | string | which event |
| status | string | QUEUED / SENT / FAILED |
| error | string? | provider error detail |
| createdAt | datetime | |
| sentAt | datetime? | |

### SmsTemplate (manager-defined)
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| eventKey | string | unique (e.g. `renewal_reminder`, `birthday_natural`) |
| body | string | with `{placeholders}` |

### Setting (key–value singleton store)
Holds institute info, the three thresholds, birthday switch/hour, and gateway config (provider, apiKey [secret], senderNumber, realSendKey). One row per key, or a single typed settings row.

| Field | Type | Notes |
|-------|------|-------|
| key | string | PK |
| value | json/string | typed per key |

### Notification
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| userId | FK → Employee | |
| message | string | |
| read | boolean | |
| createdAt | datetime | |

### ActivityHistory
The append-only audit trail behind "nothing is deleted".

| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| entityType | string | e.g. "Case", "Payment" |
| entityId | string | |
| action | string | e.g. "stage.done", "case.cancelled" |
| actorId | FK → Employee? | |
| detail | json? | before/after or context |
| createdAt | datetime | |

### EngineRunLog
| Field | Type | Notes |
|-------|------|-------|
| id | id | PK |
| runAt | datetime | |
| reminders / archived / abandoned / greetings / smsSent / errors | int | per-run counts |
| detail | json? | error specifics |

---

## Relationship summary

- Customer **1—N** Case; Case **1—N** Period; Period **1—N** CaseStage; Period **1—N** Payment.
- Service **1—N** ServicePathStage / ServiceDuration / ReminderRule; Service **1—N** Case (origin reference only — stages are copied, not referenced).
- Employee **1—N** Case (owner), **1—N** Task (owner), **1—N** PermissionException.
- Case **1—N** Task, Case **1—N** FollowUp; Task **0/1—N** FollowUp; Period **0/1—N** FollowUp.
- Period **1—N** SentReminder; Customer **1—N** BirthdayLog.
- Lookup tables (Department, ServiceCategory, PaymentMethod, FollowUpResult, CancellationReason) are referenced by FK and are **deactivated, not deleted, once used**.

> The two uniqueness constraints (SentReminder and BirthdayLog) are the load-bearing part of this schema: they are how the "only once" promise is kept in the database instead of the code.



