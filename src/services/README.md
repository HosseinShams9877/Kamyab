# services/

Business logic lives here — one module per domain (customers, cases, periods,
paths, payments, tasks, follow-ups) plus an `engine/` subfolder for the
automatic engine.

Rules:

- Route handlers (`src/app/api/**`) and components must stay thin. They validate
  input and call a service; they do not contain business rules.
- Services enforce access control and wrap multi-step operations in a single
  transaction.
- Computed values (balances, counts, current stage) are derived here, never
  stored.

Modules are added from Phase 2 onward, per `docs/roadmap/ROADMAP.md`.
