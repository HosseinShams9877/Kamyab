# Recommended Folder Structure

> A layout that enforces the brief's architecture rule: **business logic lives in `services/`, not in components or API route handlers.** Route handlers and components stay thin and call into services. Names follow the glossary ([02-glossary.md](../knowledge/02-glossary.md)) exactly.

## Top level

```
kamyab/
├── docs/                      # this knowledge layer + roadmap (English, primary)
├── prisma/
│   ├── schema.prisma          # the single source of truth for the data model
│   ├── migrations/
│   └── seed.ts                # seeds fixed enums + default settings lists + bootstrap manager
├── public/
│   └── fonts/                 # self-hosted Vazirmatn / IranSans
├── src/
│   ├── app/                   # Next.js App Router: pages + API routes (thin)
│   ├── services/              # ALL business logic (the mandated layer)
│   ├── lib/                   # cross-cutting utilities (dates, money, auth, db, permissions)
│   ├── components/            # presentational + shared UI (no business logic)
│   ├── schemas/               # Zod schemas shared by client and server
│   ├── types/                 # shared TypeScript types, fixed-enum unions
│   └── styles/                # Tailwind config entry, design tokens, globals
├── scripts/
│   └── engine.ts              # entry point the external scheduler calls (C-14)
├── .env.example
└── package.json
```

## `src/app` — routing and thin handlers

```
src/app/
├── (auth)/
│   └── login/page.tsx                 # C-1
├── (manager)/                         # manager + supervisor
│   ├── dashboard/page.tsx             # C-2
│   ├── customers/                     # C-3  (list, [id], new/edit)
│   ├── cases/                         # C-4, C-5 (new, [id] with tab segments)
│   ├── renewals/page.tsx              # C-10
│   ├── tasks/page.tsx                 # C-11
│   ├── employees/                     # C-12
│   ├── services/                      # B-1..B-4
│   ├── settings/                      # C-13 (sectioned)
│   └── reports/
├── (employee)/                        # C-15: same pages, owner-scoped filter
│   ├── dashboard/page.tsx
│   ├── my-cases/…
│   ├── tasks/…
│   └── renewals/…
├── api/                               # thin route handlers: parse → authorize → call service → respond
│   ├── customers/route.ts
│   ├── cases/route.ts
│   ├── payments/route.ts
│   └── …                              # one per resource
└── layout.tsx                         # RTL, font, top bar (global search), sidebar
```

> A route handler never contains domain rules. It validates input with a `schemas/` Zod schema, calls `lib/permissions` to authorize, invokes a `services/` function, and returns the shaped result.

## `src/services` — the business-logic layer

One module per domain area; each exports functions that own the transactions and rules. Computed values are produced here and never stored.

```
src/services/
├── customer.service.ts        # create/edit, uniqueness, deactivate-vs-delete
├── service.service.ts         # service + path (initial/renewal) + durations + reminder rules
├── case.service.ts            # registration transaction, copy-path, first period (rule 9, rule 4)
├── stage.service.ts           # stage transitions + side effects + progress computation
├── payment.service.ts         # payments + computed balance/label (rule 2)
├── period.service.ts          # renewal transaction, expiry via Jalali math (rule 10), abandonment
├── task.service.ts            # tasks, record-result, effect-on-renewal, next-task
├── followup.service.ts        # follow-up records / timeline
├── cancellation.service.ts    # cancel transaction + restore + per-reason report
├── settings.service.ts        # all manager-defined lists (B-*), used-item guards
├── employee.service.ts        # employees + deactivation-transfer
├── permission.service.ts      # role defaults XOR per-employee exceptions
├── engine/                    # C-14 automatic engine, one file per task
│   ├── reminders.ts
│   ├── abandonment.ts
│   ├── archiving.ts
│   ├── birthday.ts
│   ├── alerts.ts
│   └── sms-queue.ts
├── dashboard.service.ts       # computed indicators (rule 2)
└── search.service.ts          # global search, permission-scoped
```

## `src/lib` — cross-cutting utilities

```
src/lib/
├── db.ts                      # Prisma client singleton
├── jalali.ts                  # format/parse/add-months/clamp/Persian-digits (rule 10)
├── money.ts                   # integer-Toman formatting, 3-digit separator, Persian digits
├── auth.ts                    # session, login attempts/lockout, role redirect
├── permissions.ts             # can(user, action, record) — the server-side guard (rule 3)
└── sms/                       # gateway adapter interface + provider clients + real-send switch
```

## `src/schemas`, `src/types`, `src/components`

- **`schemas/`** — Zod objects (`customerSchema`, `caseSchema`, `paymentSchema`, …) imported by both the React Hook Form on the client and the route handler on the server. One definition, two enforcement points.
- **`types/`** — shared unions for the deliberately-fixed enums (case/stage/period statuses, roles, priorities, customer types) so the fixed values live in one place.
- **`components/`** — presentational and shared UI only (StatusBadge, PathStrip, MoneyText, JalaliDatePicker, EditableList). No fetching, no domain rules; they receive data and callbacks.

## Why this shape

- The `services/` boundary makes rule 4 (one transaction per multi-step operation) and rule 2 (compute, never store) structurally natural — the only place that writes multiple tables or derives a number is a service function.
- Sharing `schemas/` across client and server satisfies dual validation without duplicating rules.
- The `(manager)` / `(employee)` route groups realize C-15's "same pages, owner-scoped filter" without cloning components.
- `scripts/engine.ts` gives the external scheduler a single, page-less entry point (C-14).
