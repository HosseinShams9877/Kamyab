# Full Plain-Language Summary

> Source: the entire "Complete Scenario and Specification Document — Version 3". This summary is not a replacement for the document; it is a guide map to it.

## What is this system?

An operations-management system for Kamyab Legal Registration Institute. It runs the institute's whole work cycle: from selling a service to a customer, through walking the work stages, receiving money, doing follow-ups, and finally the periodic renewals. The two things that set it apart from an Excel file or an ordinary custom app are:

1. **It does not forget.** When everyone else forgets a renewal is due or a task is overdue, the system reminds them.
2. **Changing the way of working needs no developer.** The manager can define a new service, add or remove stages of a job, add a new cancellation reason, change thresholds, and edit SMS text — all from inside the system itself.

## Who is the document written for?

- **The institute manager:** wants to know exactly what the system does.
- **The developer:** wants to know exactly what to build.

The language is not technical, but the detail is complete.

## Writing conventions of the document (valid across the whole project)

- **"Required"**: until this field is filled, the Save button does not work.
- **"Automatic"**: no user enters it; the system builds or computes it itself.
- **"Computed"**: this number is stored nowhere and is rebuilt each time from other data. No one — not even the manager — can edit it by hand.
- **"Manager-definable"**: this item must be addable, editable, and reorderable from inside the system. No list carrying this label may be hardcoded.
- **"Status"** under a section heading: "Implemented" means it works right now; "Design" means it must be built.

## The three principles the whole document is built on

1. **Anything that might change tomorrow, the manager must be able to change from inside the system.** Adding a new service, changing the stages of a job, adding a new cancellation reason — none of these may require a developer.
2. **No number that can be computed is stored.** "Balance" comes from the sum of payments, "days remaining" from the date, "progress percentage" from the stages. No one may write "settled" while no payment is recorded.
3. **Nothing is ever deleted.** A case is cancelled, a task is archived, a renewal is abandoned, a customer is deactivated, a service is deactivated — but the record stays. What leaves the main screen is only clutter, not information.

## Roles (three base roles)

- **Manager (مدیر):** everything, including settings, employees, and permissions.
- **Supervisor (سرپرست):** all cases and tasks; no access to settings or employees.
- **Employee (کارمند):** only their own cases, tasks, and customers; moving the path forward, recording follow-ups, updating renewals.

A role is only a starting point. The manager can add or remove a single permission for each employee individually (an exception relative to the role default). The system stores only these differences, not the whole permission list.

## The central concept: Customer → Case → Period → Path → Stage

- One **customer** can have several **cases** (each sold service is one case).
- Each case has one or more **periods**: the first period is "registration", the later ones are "renewals".
- Each period has a **path** (copied from the service's path): the first period uses the "initial registration path", renewal periods use the "renewal path".
- Each path is made of several **stages** that carry only a title.
- **Task** differs from **stage**: a stage is a part of the service's path definition; a task is a personal to-do with a due date, assigned to an employee. A stage may lead to creating a "task", but is not itself a "task".

## Key architectural note: copy, not reference

When a case is registered, the system builds a **copy** of the service path onto that case — not a reference. Reason: if the manager changes the service path tomorrow, old cases must not suddenly have their stages changed. Old cases stay untouched and only new cases get the new path.

## What the manager defines himself (overview)

Services and their categories, each service's initial and renewal path, validity durations, reminder rules, cancellation reasons, follow-up results, payment methods, departments, time thresholds (archive, abandonment, stale), birthday-greeting settings, institute information, SMS text templates, the SMS gateway, and each employee's permissions. Details in [04-manager-defined.md](04-manager-defined.md).

## The system's pages (overview)

Login, management dashboard, customers, case registration, the case page (path card + financial card + tabs), case cancellation, periods & renewal, the renewals page with the abandoned tab, tasks/follow-ups/archive, employees & permissions, settings, the automatic engine, the employee panel, and global search. Details in [05-pages-fields.md](05-pages-fields.md).

## The automatic engine (the page-less beating heart)

A part with no page of its own that holds the product's most important promise. Every 6 hours: renewal reminders, overdue-task alerts, unfollowed-renewal alerts, task archiving, renewal abandonment, SMS-queue processing. Once a day: birthday greetings. This is the only part that needs an external setting (a Windows/server scheduler — cron). **Without it, no SMS, no greeting, and no automatic archiving happen** — this must be written prominently in the install documentation.

## The main flows

1. **From sale to delivery:** define service → register customer → register case → receive payments → move stages forward → complete.
2. **Renewal cycle:** automatic reminder → follow-up → register renewal (new period) → cycle restarts.
3. **Mid-path cancellation:** record with a mandatory reason → lock path → cancel period and open tasks → payments stay.
4. **Birthday greeting:** fully automatic, once a year per customer. Details in [06-flows.md](06-flows.md).

## A few mistakes that must not repeat (overview)

Do not hardcode any list; do not store any computable number; hiding a button is not access control; do multi-step operations in one transaction; put the "only once" guarantee in the database, not the code; the reminder condition must be "less than or equal to", not "equal to"; nothing is ever deleted; names stay fixed. Details in [07-critical-rules.md](07-critical-rules.md).

