# Recommended Folder Structure

> A **modular monolith organized by domain**. Each domain is a self-contained module
> under `src/modules/<domain>/` that owns its service, repository, schema, types, guards,
> and its own `components/`, `hooks/`, `lib/`, and `__tests__/` — all behind a single public
> `index.ts`. Anything shared by two or more modules moves up to the shared `src/` layer.
> The brief's architecture rule still holds — **business logic lives in the service layer,
> never in components or API route handlers** — and is now enforced per module. The full
> rules with worked examples live in [08-architecture-rules.md](../knowledge/08-architecture-rules.md);
> this file shows where each kind of file sits. Names follow the glossary
> ([02-glossary.md](../knowledge/02-glossary.md)) exactly.

## The 10 rules (summary)

1. A component used by only **one** module lives in that module's `components/`.
2. A component used by **two or more** modules lives in `src/components/`.
3. A pure helper used by only **one** module lives in that module's `lib/`.
4. A pure helper used by **two or more** modules lives in `src/lib/`.
5. A type used by only **one** module lives in that module's types file.
6. A type used by **two or more** modules lives in `src/types/`.
7. All tests live in a `__tests__/` folder — **never** next to the source file.
8. Every module is imported **only** through its `index.ts`. No deep imports.
9. No module imports another module's **repository** — cross-module calls go through services.
10. Shared UI in `src/components/` has **no domain logic**.

> Rules 3 and 4 use "pure helper" broadly: framework-agnostic functions **and** presentation
> data such as label maps. Rule 8's single documented exception is the client-component leaf
> import, described next.

### The documented exception — client components and the barrel

A React **client component** (`"use client"`) cannot import a module's `index.ts` when that
barrel transitively re-exports server-only code (e.g. `node:crypto` sessions, `bcrypt`,
Prisma), because Next.js walks the whole barrel graph into the client bundle and fails on
`node:` schemes. In that single case the client component imports the module's **isomorphic
leaf** directly — its `<domain>.schema.ts` or `<domain>.types.ts`, which are pure and safe on
both sides (e.g. `login-form.tsx` imports `loginSchema` from `@/modules/auth/auth.schema`).
Components **inside** the same module use ordinary relative imports for their siblings
(`../lib/permission-labels`, `../employees.types`). **Server** code (pages, layouts, route
handlers) always uses the `index.ts` public API — including the module UI, which the barrel
re-exports for it.

<!-- APPEND_MARKER -->

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
│   ├── modules/               # domain modules (auth, permissions, employees, settings, …)
│   ├── components/            # SHARED UI only — used by 2+ modules (no domain logic)
│   │   ├── ui/                # primitives: Button, Input, Badge, …
│   │   ├── providers/         # global providers (e.g. query-provider)
│   │   └── …
│   ├── lib/                   # SHARED pure utilities only (dates, money, digits, cn, db, sms)
│   │   └── __tests__/         # tests for the shared utilities
│   ├── types/                 # SHARED types: enums.ts, enums.schema.ts, *.d.ts
│   └── hooks/                 # SHARED hooks only, if any
├── scripts/
│   └── engine.ts              # entry point the external scheduler calls (C-14)
├── .env.example
└── package.json
```

> `src/components/`, `src/lib/`, `src/types/`, and `src/hooks/` hold **only** what two or more
> modules share. Anything used by a single domain lives inside that module (rules 1, 3, 5).

## `src/modules` — one self-contained module per domain

Every domain area is a folder with the same shape. The **repository** owns all Prisma access
for the domain; the **service** holds the transactions and business rules and is the only
cross-module entry point; **schema** holds the Zod objects shared by client and server;
**types** holds the domain's TypeScript types; **guards** holds pure decision functions;
`components/`, `hooks/`, and `lib/` hold the module's own UI, hooks, and pure helpers; and
`__tests__/` holds every test for the module. `index.ts` is the public API.

```
src/modules/<domain>/
├── index.ts                   # public API — the ONLY import surface for other code
├── <domain>.service.ts        # business logic + transactions (rule 4), the public entry
├── <domain>.repository.ts     # ALL Prisma access for this domain (called only by its service)
├── <domain>.schema.ts         # Zod objects shared by client + server (isomorphic leaf)
├── <domain>.types.ts          # domain TypeScript types (isomorphic leaf)
├── <domain>.guards.ts         # pure decision functions, if any
├── components/                # module-specific UI only (client leaves import the schema/types leaf)
├── hooks/                     # module-specific React hooks, if any
├── lib/                       # module-specific pure helpers / presentation data, if any
└── __tests__/                 # ALL tests for this module (rule 7)
```

Not every module needs every folder — `components/`, `hooks/`, and `lib/` appear only when the
module actually has them. The **implemented** `employees` module shows the full shape:

```
src/modules/employees/
├── index.ts                   # re-exports the service API, schema/types, ROLE_LABELS, and the UI
├── employees.service.ts       # create/edit/deactivate/reactivate, permissions view, workload
├── employees.repository.ts    # all Prisma reads/writes + the transfer-and-deactivate transaction
├── employees.schema.ts        # create/update/set-password/permissions/deactivate Zod schemas
├── employees.types.ts         # EmployeeDetail, DepartmentOption, Workload, PermissionsView, …
├── employees.guards.ts        # evaluateDeactivation + Persian message builders (pure)
├── components/                # employee-form, set-password-form, permission-matrix, …
├── lib/                       # permission-labels.ts (ROLE_LABELS + PERMISSION_GROUPS, pure data)
└── __tests__/                 # employees.guards / employees.repository / employees.service tests
```

The barrel re-exports the module UI so **server** pages import it through `@/modules/employees`
(rule 8), while the client components themselves import the isomorphic `employees.schema` /
`employees.types` leaf and their sibling `../lib/permission-labels` directly (the exception).

### Planned modules

```
src/modules/
├── auth/            # login, sessions, throttle/lockout, role redirect          [implemented]
├── permissions/     # role defaults XOR per-employee exceptions, can() guard     [implemented]
├── settings/        # manager lists (B-*), institute info, used-item guards      [implemented]
├── employees/       # C-12 employee management, permission matrix, deactivation  [implemented]
├── customers/       # create/edit, uniqueness, deactivate-vs-delete
├── services/        # service definitions + reminder rules
├── paths/           # initial/renewal paths, stages, durations, progress
├── periods/         # renewal transaction, expiry via Jalali math (rule 10), abandonment
├── cases/           # registration transaction, copy-path, first period (rule 9, rule 4)
├── payments/        # payments + computed balance/label (rule 2)
├── tasks/           # tasks, record-result, effect-on-renewal, next-task
├── followups/       # follow-up records / timeline
├── engine/          # C-14 engine (reminders, abandonment, archiving, birthday, alerts, sms-queue)
└── …                # cancellation, dashboard, search — added as their phase arrives
```

> Modules are created when their phase begins — there are **no empty stub modules** for
> unbuilt domains. Phases 1–5 delivered `auth`, `permissions`, `settings`, and `employees`.

<!-- APPEND_MARKER_2 -->

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
│   ├── employees/…                    # route.ts + [id]/… (password, permissions, deactivate, reactivate)
│   ├── customers/route.ts
│   ├── cases/route.ts
│   └── …                              # one per resource
└── layout.tsx                         # RTL, font, top bar (global search), sidebar
```

> A route handler never contains domain rules. It validates input with a module's Zod schema,
> calls `@/modules/permissions` to authorize, invokes a module service via its `index.ts`, and
> returns the shaped result. Pages likewise import module data **and module UI** through the
> module `index.ts`.

## `src/lib` — SHARED pure utilities

Only framework-agnostic, domain-agnostic helpers and shared infrastructure used by **two or
more** modules live here (rule 4). No business rules. A helper used by a single domain belongs
in that module's `lib/` (rule 3).

```
src/lib/
├── db.ts                      # Prisma client singleton (shared infrastructure)
├── jalali.ts                  # format/parse/add-months/clamp/Persian-digits (rule 10)
├── money.ts                   # integer-Toman formatting, 3-digit separator, Persian digits
├── digits.ts                  # Persian ↔ English digit conversion
├── cn.ts                      # className merge helper (clsx + tailwind-merge)
├── sms/                       # gateway adapter interface + provider clients + real-send switch
└── __tests__/                 # jalali.test.ts, money.test.ts (rule 7 — tests never sit beside source)
```

## `src/types` and `src/components`

- **`types/`** — global shared TypeScript types (used by 2+ modules, rule 6) plus the
  deliberately-fixed enums. `enums.ts` holds the string-union types (case/stage/period
  statuses, roles, priorities, customer types) and `enums.schema.ts` holds their matching Zod
  definitions, so the fixed values live in one place usable by both type-checking and runtime
  validation. (Fixed enums are `String` + Zod, not Prisma enums, so the model runs on both
  SQLite dev and PostgreSQL prod.) A type used by a single module stays in that module's
  `<domain>.types.ts` (rule 5).
- **`components/`** — SHARED, presentational UI only (rule 2 + rule 10): primitives under
  `ui/` (StatusBadge, MoneyText, JalaliDatePicker, …) and global `providers/` (e.g.
  `query-provider`). No fetching, no domain rules; they receive data and callbacks. **Domain**
  components (login/logout, employee forms, the permission matrix) are **not** here — they live
  in their module's `components/` (rule 1).

## Why this shape

- The per-module **service boundary** makes rule 4 (one transaction per multi-step operation)
  and rule 2 (compute, never store) structurally natural — the only place that writes multiple
  tables or derives a number is a module's service function, over its own repository.
- **Encapsulation via `index.ts`** means a module can reorganize its internals freely without
  breaking consumers, and cross-module coupling is limited to published service APIs.
- **Co-locating** a domain's UI, hooks, helpers, and tests with its logic keeps everything one
  folder move from being extracted into a separate backend later; the shared layer stays small
  and genuinely cross-cutting.
- Sharing each module's `schema.ts` across client and server satisfies dual validation without
  duplicating rules.
- The `(manager)` / `(employee)` route groups realize C-15's "same pages, owner-scoped filter"
  without cloning components.
- `scripts/engine.ts` gives the external scheduler a single, page-less entry point (C-14) that
  drives the `engine` module.

