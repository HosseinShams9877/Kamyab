# Recommended Folder Structure

> A **modular monolith organized by domain**. Each domain is a self-contained module
> under `src/modules/<domain>/` that owns its own service, schema, types, repository,
> and a public `index.ts`. The brief's architecture rule still holds — **business logic
> lives in the service layer, never in components or API route handlers** — and is now
> enforced per module. Names follow the glossary ([02-glossary.md](../knowledge/02-glossary.md)) exactly.

## Module rules (enforced everywhere)

1. **Each module contains its own** `service`, `schema`, `types`, `repository`, and `index.ts`.
2. **A module may only be imported through its `index.ts`** (its public API). No deep imports
   into another module's internals.
3. **No module imports another module's repository.** Cross-module calls go through the
   other module's service layer (exposed via its `index.ts`) only.
4. **Cross-cutting pure utilities stay in `src/lib/`** (dates, money, digits, cn, db client, sms adapter).
5. **Shared UI components stay in `src/components/`** (presentational only, no domain rules).

### One documented exception — client components and the barrel

A React **client component** (`"use client"`) cannot import a module's `index.ts` when that
barrel transitively re-exports server-only code (e.g. `node:crypto` sessions, `bcrypt`),
because Next.js walks the whole barrel graph into the client bundle and fails on `node:`
schemes. In that single case the client component imports the module's **isomorphic leaf**
directly — its `<domain>.schema.ts` or `<domain>.types.ts`, which are pure and safe on both
sides (e.g. `login-form.tsx` imports `loginSchema` from `@/modules/auth/auth.schema`). Server
code always uses the `index.ts` public API.

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
│   ├── modules/               # domain modules (service + schema + types + repository + index)
│   ├── lib/                   # cross-cutting PURE utilities (dates, money, digits, cn, db, sms)
│   ├── components/            # presentational + shared UI (no business logic)
│   ├── types/                 # global shared TypeScript types + fixed-enum unions/Zod
│   └── styles/                # Tailwind config entry, design tokens, globals
├── scripts/
│   └── engine.ts              # entry point the external scheduler calls (C-14)
├── .env.example
└── package.json
```

## `src/modules` — one self-contained module per domain

Every domain area is a folder with the same five-file shape. The **repository** owns all
Prisma access for the domain; the **service** holds the transactions and business rules and
is the only cross-module entry point; **schema** holds the Zod objects shared by client and
server; **types** holds the domain's TypeScript types; **index.ts** is the public API.

```
src/modules/<domain>/
├── <domain>.service.ts        # business logic + transactions (rule 4), the public entry
├── <domain>.repository.ts     # ALL Prisma access for this domain (called only by its service)
├── <domain>.schema.ts         # Zod objects shared by client + server
├── <domain>.types.ts          # domain TypeScript types
└── index.ts                   # public API — the ONLY import surface for other code
```

### Planned modules

```
src/modules/
├── auth/            # login, sessions, throttle/lockout, role redirect          [implemented]
├── permissions/     # role defaults XOR per-employee exceptions, can() guard     [implemented]
├── settings/        # manager lists (B-*), institute info, used-item guards      [implemented]
├── customers/       # create/edit, uniqueness, deactivate-vs-delete
├── services/        # service definitions + reminder rules
├── paths/           # initial/renewal paths, stages, durations, progress
├── periods/         # renewal transaction, expiry via Jalali math (rule 10), abandonment
├── cases/           # registration transaction, copy-path, first period (rule 9, rule 4)
├── payments/        # payments + computed balance/label (rule 2)
├── tasks/           # tasks, record-result, effect-on-renewal, next-task
├── followups/       # follow-up records / timeline
├── engine/          # C-14 engine (reminders, abandonment, archiving, birthday, alerts, sms-queue)
└── …                # employees, cancellation, dashboard, search — added as their phase arrives
```

> Modules are created when their phase begins — there are **no empty stub modules** for
> unbuilt domains. Phases 1–4 delivered `auth`, `permissions`, and `settings`.

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

> A route handler never contains domain rules. It validates input with a module's Zod schema,
> calls `@/modules/permissions` to authorize, invokes a module service via its `index.ts`, and
> returns the shaped result. Route handlers may use the shared `@/lib/db` client directly for
> trivial demo reads, but real domain reads/writes belong in a module repository behind its service.

## `src/lib` — cross-cutting PURE utilities

Only framework-agnostic, domain-agnostic helpers and shared infrastructure live here. No
business rules.

```
src/lib/
├── db.ts                      # Prisma client singleton (shared infrastructure)
├── jalali.ts                  # format/parse/add-months/clamp/Persian-digits (rule 10)
├── money.ts                   # integer-Toman formatting, 3-digit separator, Persian digits
├── digits.ts                  # Persian ↔ English digit conversion
├── cn.ts                      # className merge helper (clsx + tailwind-merge)
└── sms/                       # gateway adapter interface + provider clients + real-send switch
```

## `src/types` and `src/components`

- **`types/`** — global shared TypeScript types plus the deliberately-fixed enums. `enums.ts`
  holds the string-union types (case/stage/period statuses, roles, priorities, customer types)
  and `enums.schema.ts` holds their matching Zod definitions, so the fixed values live in one
  place usable by both type-checking and runtime validation. (Fixed enums are `String` + Zod,
  not Prisma enums, so the model runs on both SQLite dev and PostgreSQL prod.)
- **`components/`** — presentational and shared UI only (StatusBadge, PathStrip, MoneyText,
  JalaliDatePicker, EditableList, auth forms/buttons). No fetching, no domain rules; they
  receive data and callbacks. Client components import module schemas/types from the module's
  isomorphic leaf (see the documented exception above).

## Why this shape

- The per-module **service boundary** makes rule 4 (one transaction per multi-step operation)
  and rule 2 (compute, never store) structurally natural — the only place that writes multiple
  tables or derives a number is a module's service function, over its own repository.
- **Encapsulation via `index.ts`** means a module can reorganize its internals freely without
  breaking consumers, and cross-module coupling is limited to published service APIs.
- Sharing each module's `schema.ts` across client and server satisfies dual validation without
  duplicating rules.
- The `(manager)` / `(employee)` route groups realize C-15's "same pages, owner-scoped filter"
  without cloning components.
- `scripts/engine.ts` gives the external scheduler a single, page-less entry point (C-14) that
  drives the `engine` module.



