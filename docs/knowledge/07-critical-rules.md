# Critical Rules — Mistakes That Must Not Repeat (Section E-3)

> Source: section E-3. These are the rules whose violation quietly breaks the system. Every one traces back to the three founding principles in [03-principles.md](03-principles.md). If code ever conflicts with this list, this list wins and the code must be fixed.

## 1 — Do not hardcode any list

Every list the manager can define (services, categories, paths, durations, reminder rules, cancellation reasons, follow-up results, payment methods, departments, thresholds, SMS text) must be read from the database, never written in the source.

**Why:** the golden rule — anywhere something is hardcoded, six months later someone must write code again just to change a phrase. See [04-manager-defined.md](04-manager-defined.md).

**How to apply:** if you are about to type a Persian label, a status list, or a message body as a string literal in a component or route, stop — it almost certainly belongs in settings. The only fixed lists are the deliberately-fixed enums in [03-principles.md](03-principles.md).

## 2 — Do not store any computable number

Balance, paid, payment percentage, path progress percentage, days remaining, task overdue status, financial status label, and dashboard counts are **computed on read**, never stored.

**Why:** a stored derived number drifts out of sync with its source the moment either changes, and then two "truths" disagree. No one may write "settled" while no payment is recorded.

**How to apply:** these values have no column in the database. Compute them in the `services/` layer from payments, dates, and stage statuses each time they are needed.

## 3 — Hiding a button is not access control

Permission must be enforced on the **server**. Hiding a button in the UI is only cosmetic; a direct request to the server for a forbidden action must be rejected there.

**Why:** anyone can craft the request directly. A hidden button stops an honest click, not an attacker.

**How to apply:** every mutating route re-checks the caller's permission for that specific action and record, independent of what the UI showed. The UI hiding is an extra courtesy, not the control.

## 4 — Multi-step operations must be one transaction

Case registration, cancellation, renewal, recording a result, and employee-deactivation transfer each touch several tables. Each must be a single atomic transaction — all steps succeed or none do.

**Why:** a half-done operation (a case with no path, a renewal with no new period) is corrupt data that is hard to detect and harder to repair. As stated in C-4: if creating the stages fails, the case must not be created either.

**How to apply:** wrap the whole multi-step operation in one Prisma transaction in the `services/` layer.

## 5 — Put the "only once" guarantee in the database, not the code

"Send each reminder once per period" and "greet each customer once per year" must be enforced by database uniqueness constraints — reminders unique on (period, rule, channel); birthday unique on (customer, year) — not by an in-code check.

**Why:** an in-code check has a race window; two concurrent engine runs can both pass it and send twice. A unique constraint cannot be raced.

**How to apply:** define the constraints in the schema; treat a unique-violation on insert as "already sent", not an error.

## 6 — The reminder condition is "less than or equal to", not "equal to"

A reminder rule fires when days-remaining is **≤** its threshold and it has not fired yet — not only on the exact day.

**Why:** if the condition were "equal" and the engine missed the exact day (server down, cron skipped), that reminder would be lost forever. With "≤", the next run makes up for it.

**How to apply:** the engine's due query is `daysBefore >= daysRemaining` combined with the "not yet sent" guarantee from rule 5.

## 7 — Nothing is ever deleted

Cases are cancelled, tasks archived, renewals abandoned, customers and services and employees deactivated — the record always stays. Full delete is allowed only in the explicit exceptions where no dependent data exists (a customer with no case, a task with no follow-up, a settings-list item used nowhere).

**Why:** what leaves the daily screen is clutter, not information. Deleted history cannot be reported on, searched, or audited.

**How to apply:** default every "remove" affordance to deactivate/archive/cancel/abandon. Enable a true delete button only after checking there are zero dependents.

## 8 — Names stay fixed

Each entity has exactly one name used everywhere — database tables, variables, UI text, and docs. Do not write "request" or "order" where the glossary says "case". See the forbidden-alias table in [02-glossary.md](02-glossary.md).

**Why:** inconsistent naming across layers makes the codebase and its conversations ambiguous, and ambiguity is where bugs hide.

**How to apply:** use the glossary's suggested code names (`Case`, `Period`, `Stage`, `Task`, `FollowUp`, `Payment`, …) as the single source of truth for identifiers and labels.

## 9 — Copy the path, do not reference it

When a case (or a renewal period) is registered, copy the service's path stages onto it. Never make the case's stages a live reference to the service definition.

**Why:** if it were a reference, editing a service path tomorrow would silently rewrite the stages — and thus the history — of every old case. With a copy, old cases stay untouched and only new ones get the new path. See [01-summary.md](01-summary.md).

**How to apply:** at registration, snapshot the current path into per-case stage rows; later service edits affect only future cases.

## 10 — Dates are Jalali, computed by calendar, not by adding days

Expiry is computed on the Jalali (Shamsi) calendar: "1 year" means the same day and month next year (1405/07/01 → 1406/07/01), not +365 days. If the target day does not exist in the target month, clamp to the last day of that month.

**Why:** adding days drifts against the calendar the institute and its customers actually use, and produces wrong expiry dates. The clamping case (e.g. 31st + 6 months into a 30-day month) must be tested.

**How to apply:** do all date math with a Jalali-aware library and month-based addition plus last-day clamping; store the month count on the duration, per [04-manager-defined.md](04-manager-defined.md).
