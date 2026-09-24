# Project Roadmap — Kamyab Operations System

> Phase-based plan, ordered by priority and dependency. Each phase lists **what to build**, **dependencies**, a **relative size** (short / medium / long), and a **"done" criterion**. Sizes are relative to each other, not calendar estimates.

## Ordering rationale

The order follows the dependency graph, not the feature list in the document. Three things must exist before any feature is meaningful: the technical foundation, the data model, and access control. Building a feature page before permissions exist means retrofitting security later — exactly the "hiding a button is not access control" mistake ([07-critical-rules.md](../knowledge/07-critical-rules.md), rule 3). So auth and the permission layer come early (phases 3–4), before any CRUD page.

Within the feature phases, the order mirrors the domain chain **Customer → Case → Period → Path → Stage**: you cannot register a case without services and customers, and you cannot renew or cancel without a case. The automatic engine (phase 15) comes late because it depends on nearly every entity, but it is not optional — it is the product's core promise.

Everything below assumes the mandatory stack in [tech-stack.md](tech-stack.md), the folder layout in [folder-structure.md](folder-structure.md), and the schema in [database-schema.md](database-schema.md).

---

## Phase 1 — Technical foundation

**What to build:** Next.js (App Router) + TypeScript project; Tailwind configured with the mandatory color tokens (primary #0F766E, hover #0D9488, etc.), radii (cards 12–16, buttons/badges 8), subtle shadows; RTL layout and Vazirmatn/IranSans font; base app shell (top bar with global-search slot, sidebar, content area); a shared Jalali date utility module (format, parse, month-based add with last-day clamping, Persian digits); a shared money formatter (integer Toman, 3-digit separator, Persian digits); the `services/` layer skeleton and a shared error/response convention for API routes.

**Dependencies:** none.

**Size:** medium.

**Done when:** the app builds and runs, renders an RTL page in the correct font and palette, and the Jalali utility passes unit tests including the clamping case (31st + 6 months → last day of a 30-day month).

## Phase 2 — Data model and migrations

**What to build:** the full Prisma schema for every entity in [database-schema.md](database-schema.md); the deliberately-fixed enums as real enums; initial migration; a seed script that inserts the default settings lists (7 cancellation reasons, 8 follow-up results with their effect-on-renewal flags, payment methods, categories, thresholds 7/30/10, birthday defaults) and one bootstrap manager account.

**Dependencies:** Phase 1.

**Size:** long.

**Done when:** `prisma migrate` creates the schema on PostgreSQL, the seed runs idempotently, and every glossary entity ([02-glossary.md](../knowledge/02-glossary.md)) has a table with its exact code name.

## Phase 3 — Authentication and sessions

**What to build:** the login page (C-1) with mobile+password; server-side credential check with the generic "mobile or password is incorrect" message; 5-attempts-then-15-minute lockout; 12-hour session; inactive-user rejection (including mid-session); role-based redirect (manager/supervisor → dashboard, employee → employee panel); no self-signup.

**Dependencies:** Phase 2.

**Size:** medium.

**Done when:** a seeded user can log in and is redirected by role, wrong credentials are rate-limited and give the generic message, and a deactivated user's next request is rejected server-side.

## Phase 4 — Permission layer (server-side access control)

**What to build:** the three base roles with their default permission maps; per-employee exception storage (store only differences, not the full list); a server-side guard used by every mutating route and data query — `can(user, action, record?)`; the "view all vs. view own" distinction that scopes queries to the owner for employees. This is infrastructure, not a page.

**Dependencies:** Phase 3.

**Size:** medium.

**Done when:** a route protected by the guard rejects a forbidden direct request regardless of UI, an employee's queries return only their own records, and permission = role-default XOR stored-exception is unit-tested.

## Phase 5 — Employees and permissions page (C-12)

**What to build:** employee CRUD form; the module/permission matrix UI with role-default labels and per-permission exception toggles; the deactivation flow that blocks when the employee has active cases/open tasks and forces choosing a successor, then transfers everything in one transaction and notifies them; the guards (no self-deactivate, last-active-manager protection, set-not-see password).

**Dependencies:** Phase 4.

**Size:** medium.

**Done when:** a manager can create employees, adjust individual permissions, and deactivate an employee only after reassigning their work — all enforced server-side.

## Phase 6 — Settings module (C-13, section B)

**What to build:** the sectioned settings page; the shared editable-list pattern (add, in-place edit, reorder, activate/deactivate, delete-only-if-unused) used by cancellation reasons, follow-up results (with the effect-on-renewal field), payment methods, service categories, departments; institute information; the three time thresholds with per-field explanatory text and zero rejection; birthday settings; SMS templates with placeholders and preview; SMS gateway with the real-send safety key; SMS status view.

**Dependencies:** Phase 4 (guards), Phase 2 (seeded defaults).

**Size:** long.

**Done when:** every list from [04-manager-defined.md](../knowledge/04-manager-defined.md) is manager-editable with immediate save, a used item cannot be deleted (only deactivated), and no such list remains hardcoded.

## Phase 7 — Services, paths, durations, reminder rules (B-1 to B-4)

**What to build:** service CRUD (name/category/description/renewable/status) with the renewable toggle hiding durations/reminders/renewal-path; the two ordered path editors (initial + renewal) with move-up/down/delete; validity durations with month count and single default; reminder rules (days-before, channel, recipient, active); deactivate-vs-delete rules for a used service.

**Dependencies:** Phase 6 (categories), Phase 4.

**Size:** long.

**Done when:** a manager can define a full service like the D-1 "Business card" (six initial stages, five renewal stages, a 12-month duration, five reminder rules), and a used service/duration can only be deactivated, not deleted.

## Phase 8 — Customers (C-3)

**What to build:** customer CRUD with the natural/legal branching form; all validations (mobile uniqueness with the "already registered: <name>" message, national-ID control digit, future-date rejection); the greeting checkbox tied to birth-date presence; the customer list with search/filter/sort/server-pagination; the per-customer page (cases, total balance, follow-up timeline, pre-filled new-case button); delete-if-no-case vs. deactivate.

**Dependencies:** Phase 4.

**Size:** long.

**Done when:** customers of both types can be created with correct validation, found by every documented search key, and only deleted when they have no case.

## Phase 9 — Case registration and case page shell (C-4, C-5)

**What to build:** the case-registration form with all live behavior (customer pick reveals birth fields when missing; service pick loads durations and hides duration/expiry when non-renewable; expiry recomputed on start-date/duration change; stage-count hint; double-submit guard); the single transaction that creates the case + number, saves birth date on the **customer**, **copies** the initial path, creates the first period (if renewable), notifies the owner, writes history, and redirects; the case page shell (header, the two cards' frames, the five tabs).

**Dependencies:** Phases 7 (services/paths/durations), 8 (customers).

**Size:** long.

**Done when:** saving once produces a fully-formed case with a copied path and first period atomically, expiry is Jalali-computed and read-only, and a failure in any step rolls back the whole thing.

## Phase 10 — Path card and stage engine (C-6)

**What to build:** the stage strip and vertical list; the six stage actions (Start, Done, Reject, Not needed, Reopen, Note) with their exact transitions; mandatory note on reject and the attempt counter; the side effects (update current stage, last-activity time, promote case New→In Progress, write history); computed progress percentage (Done + Not Needed count as passed); the blocked states (cancelled case, non-owner without permission, forbidden direct request).

**Dependencies:** Phase 9.

**Size:** medium.

**Done when:** advancing/rejecting stages behaves exactly as C-6 specifies, progress and current-stage are computed (never stored), and forbidden stage actions are rejected server-side.

## Phase 11 — Financial card and payments (C-7)

**What to build:** the financial card with the stored (total, payments) vs. computed (paid, balance, percentage, label) split; the payment-record form with validation and the "for which period" field when a case has more than one period; adjust-total and delete-payment (both recorded in history); Toman/Persian-digit formatting; overpaid handling; the separate view-financial vs. record/delete permissions.

**Dependencies:** Phase 9 (case/periods), Phase 4.

**Size:** medium.

**Done when:** balance and label are always computed from payments, an empty total shows "—" not zero, overpayment is allowed and labeled, and no computed value is stored.

## Phase 12 — Tasks, follow-ups, archive (C-11)

**What to build:** task CRUD; the tasks-page tabs (all/today/overdue/my/assigned/completed/archive); record-result with the settings result list, the effect-on-renewal auto-update of the active period's follow-up status, and the optional "next task"; manual archive/unarchive; computed overdue; delete-only-if-no-followup; assignment rules (no inactive employee, employees can't touch others' tasks).

**Dependencies:** Phase 9 (cases), Phase 6 (follow-up results), Phase 4.

**Size:** medium.

**Done when:** recording a result closes the task, writes a follow-up to the timeline, and—when the result's effect is set—updates the period's follow-up status in one transaction, with overdue computed live.

## Phase 13 — Periods, renewal, renewals page, abandoned tab (C-9, C-10)

**What to build:** the period cards with the separate expiry-status and follow-up-status; the renewal form and its transaction (close+Renewed previous, create next period, update case expiry, **copy the renewal path**, restart reminders); the renewals page tabs (all/urgent/near/expired/no-follow-up/abandoned); the exact abandonment rule (threshold, plus the "not interested" immediate branch); restore-from-abandoned.

**Dependencies:** Phases 10 (path copy mechanics), 11 (period financials), 12 (follow-up effect).

**Size:** long.

**Done when:** a renewal produces a new period with a copied renewal path atomically, the renewals tabs classify periods correctly, and abandonment/restore behave per C-10 (engine-driven abandonment lands in Phase 15).

## Phase 14 — Case cancellation and restore (C-8)

**What to build:** the cancel dialog with the open-items warning and the mandatory reason; the cancellation transaction (status, lock path, cancel active period, cancel open tasks + notify, drop from counts, write history); the deliberate non-effects (payments/total/balance untouched, not deleted); manager-only restore; the per-reason cancellation report.

**Dependencies:** Phases 9, 10, 12; Phase 6 (reasons).

**Size:** medium.

**Done when:** cancelling requires a reason, performs all steps atomically, leaves payments and the record intact, and the per-reason report shows counts over a chosen span.

## Phase 15 — Automatic engine (C-14)

**What to build:** a page-less runner invoked by an external scheduler (cron / Windows Task Scheduler) with a single entry endpoint or CLI; the seven tasks (renewal reminders, overdue-task alerts, unfollowed-renewal alerts, task archiving, renewal abandonment, birthday greetings, SMS-queue processing); the database uniqueness constraints for "once" ((period, rule, channel) and (customer, year)); the "≤" due condition; the 24-hour anti-repeat on managerial alerts; skip for abandoned/cancelled; per-run logging (counts + errors); the SMS gateway adapter honoring the real-send safety key.

**Dependencies:** Phases 7 (reminder rules), 11, 12, 13 (the entities it acts on), 6 (thresholds, templates, gateway).

**Size:** long.

**Done when:** running the engine sends each due reminder exactly once even across repeated runs, greets each customer once per year, archives/abandons per thresholds, logs every run, and a missed run is fully made up by the next — verified by tests that run the engine twice and assert no duplicates. **Install docs must state the scheduler is mandatory.**

## Phase 16 — Dashboard, global search, employee panel, reports

**What to build:** the management dashboard (C-2) with all computed indicators and their click-through filters, the bottom tables, the mandatory "workload not evaluation" note, and empty states; global search (C-16) across all documented keys, categorized, permission-respecting, including cancelled/abandoned records; the employee panel (C-15) as the same pages with an owner-scoped filter — no new queries or components; and the reports surfaced along the way (cancellation-by-reason, workload).

**Dependencies:** essentially all prior phases (it aggregates them).

**Size:** medium.

**Done when:** every dashboard number is computed and links to the matching filtered list, search finds records across entities within the caller's permissions, and the employee panel reuses the manager pages with only an ownership filter.

---

## Summary table

| # | Phase | Size | Key dependencies |
|---|-------|------|------------------|
| 1 | Technical foundation | medium | — |
| 2 | Data model & migrations | long | 1 |
| 3 | Auth & sessions | medium | 2 |
| 4 | Permission layer (server-side) | medium | 3 |
| 5 | Employees & permissions page | medium | 4 |
| 6 | Settings module | long | 4, 2 |
| 7 | Services, paths, durations, reminders | long | 6, 4 |
| 8 | Customers | long | 4 |
| 9 | Case registration & case shell | long | 7, 8 |
| 10 | Path card & stage engine | medium | 9 |
| 11 | Financial card & payments | medium | 9, 4 |
| 12 | Tasks, follow-ups, archive | medium | 9, 6, 4 |
| 13 | Periods, renewal, abandoned tab | long | 10, 11, 12 |
| 14 | Case cancellation & restore | medium | 9, 10, 12, 6 |
| 15 | Automatic engine | long | 7, 11, 12, 13, 6 |
| 16 | Dashboard, search, employee panel, reports | medium | all |

> **A note on "already Implemented" statuses.** The knowledge layer marks several pages "Implemented" and others "Design", implying a partial existing codebase. This roadmap is written as a clean build-order. If an existing codebase is provided, the same phases apply as an audit-and-complete order rather than a from-scratch order — see the open question in [../REPORT.md](../REPORT.md).



