# Phase-One Report

> Task Four: confirmation of what was produced, open questions and ambiguities that need the manager's/owner's decision, and suggestions for improvement. This is the deliverable to read alongside the knowledge layer and roadmap.

## 1 — Status confirmation

| Deliverable | Status |
|-------------|--------|
| Reference document read fully (sections A–E) | ✅ Done |
| Knowledge layer built | ✅ Done — `docs/knowledge/` (English, primary) with a frozen Persian reference in `docs/knowledge/fa-reference/` |
| Roadmap ready | ✅ Done — `docs/roadmap/` (16 phases, tech stack, folder structure, DB schema, indexes) |
| Implementation code | ⛔ Not started — this is Phase One only, as instructed |

**Knowledge-layer files (English, primary):**
- `README.md` — index + language policy + golden rule
- `01-summary.md` — full plain-language summary
- `02-glossary.md` — exact glossary + forbidden aliases
- `03-principles.md` — three principles + deliberately-fixed items
- `04-manager-defined.md` — B-0 to B-10 (everything the manager defines)
- `05-pages-fields.md` — C-1 to C-16 (every page, field by field)
- `06-flows.md` — D-1 to D-4 (the four complete flows)
- `07-critical-rules.md` — E-3 (ten mistakes that must not repeat)

**Roadmap files:**
- `ROADMAP.md`, `tech-stack.md`, `folder-structure.md`, `database-schema.md`, `database-indexes.md`

**Language policy applied throughout:** English for all docs, code comments, file names, commit messages; Persian reserved for UI text, SMS templates, and institute information. The Persian originals are frozen in `fa-reference/` and are not maintained going forward.

## 2 — Open questions and ambiguities

These are points where the document is silent or could be read two ways. None blocked the knowledge layer or roadmap, but each needs a decision before or during implementation.

1. **Existing codebase vs. clean build.** The knowledge layer marks many pages "Implemented" and others "Design", implying a partial codebase already exists. Is there code to audit-and-extend, or does Phase Two start from scratch? The roadmap is written to work either way, but the answer changes whether phases are "build" or "verify-and-complete".

2. **Case/customer numbering reset and format.** Numbers (PR-1405-0284, CU-1405-0013) restart per Jalali year. Two things are unspecified: the zero-padding width, and behavior at year rollover (does a case created in Esfand and completed in Farvardin keep its original-year number? — assumed yes). Please confirm the exact format and padding.

3. **National-ID / entity-ID uniqueness.** Mobile is explicitly unique. It is not stated whether national ID and national entity ID must also be unique. Assumed **not enforced unique** (they are optional and can be blank), but this should be confirmed — two records with the same national ID may be a data-entry error worth warning about.

4. **"For which period" default.** On the payment form, when a case has multiple periods, which period is pre-selected? Assumed the **active** period. Confirm.

5. **Reminder recipient "all managers".** Does this mean every user with the Manager role, or Manager + Supervisor? Assumed **Manager role only**. Confirm, because it affects who gets bombarded.

6. **SMS cost / balance.** The gateway config covers provider, key, sender, and the real-send switch. Nothing addresses gateway credit running out — should a failed send due to no credit surface as a distinct alert to the manager? Recommended, not specified.

7. **Time zone and "today".** The engine's "birthday is today", "overdue", and threshold math all depend on a definition of the current day. Assumed the server's local time in Iran (Asia/Tehran). Confirm the server will run in that zone, since off-by-one-day errors here are user-visible.

8. **Session concurrency.** A 12-hour session is specified. It is not stated whether one user may have multiple concurrent sessions (phone + desktop) or whether a new login invalidates the old. Assumed **multiple allowed**. Confirm.

9. **Exceptional per-case stage across renewals.** An exceptional stage (C-6/B-2) is added to a specific case. Since paths are per-**period**, is an exceptional stage bound to the current period only, or does it persist into the next renewal period? Assumed **current period only**. Confirm.

10. **Reports scope.** The document names two reports explicitly (cancellation-by-reason, workload). Are broader reports (revenue over time, renewals conversion rate, per-employee throughput) in scope for the first release or deferred? Assumed **deferred** beyond the two named.

## 3 — Suggestions for improvement

Offered as recommendations, not changes to the spec.

1. **A dry-run / preview mode for the engine.** Beyond the SMS real-send switch, a way to run the engine and see "what it *would* do" (which reminders, abandonments, greetings) without acting is invaluable for verifying configuration after install — and for debugging a missed run.

2. **An audit view on top of `ActivityHistory`.** The schema records everything; a simple filterable history screen (by entity, actor, date) turns that data into an operational tool and directly supports the "nothing is deleted" principle.

3. **Soft warning on likely-duplicate customers.** Even if national IDs are not unique-enforced, warning "a customer with this national ID already exists: <name>" at registration prevents the split-history problem the mobile-uniqueness rule already guards against.

4. **Explicit test cases for the two hardest rules.** The Jalali clamping case (31st + 6 months) and the "engine runs twice → no duplicate send" case are the two places most likely to break silently. The roadmap makes both a "done" criterion; I recommend they be written as automated tests before their features are considered complete.

5. **Settings change log.** Because thresholds and templates change system behavior, recording who changed a setting and when (a small extension of `ActivityHistory`) would help diagnose "why did behavior change last week?".

6. **Notification read-state and digest.** The 24-hour anti-repeat on manager alerts is good; a lightweight daily digest option ("3 overdue-task situations, 2 unfollowed renewals") would reduce noise further without losing signal.

7. **Backup and the scheduler in install docs together.** Since the engine depends on an external scheduler and the whole product depends on the database, the install documentation should treat "scheduler configured" and "backups configured" as a single go-live checklist, both prominent.

## 4 — Bottom line

The document is unusually complete and internally consistent; the three founding principles and the ten critical rules gave a firm backbone for every decision in the knowledge layer and roadmap. The ambiguities above are edge-case clarifications, not gaps in the core design. Phase Two (implementation) can begin against this roadmap as soon as the codebase question (#1) and the numbering/timezone questions (#2, #7) are answered.
