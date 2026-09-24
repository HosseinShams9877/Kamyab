# 08 — Architecture Rules

> How the codebase is organized and the rules every module follows. This is the companion to
> [folder-structure.md](../roadmap/folder-structure.md): that file shows the layout, this one
> states the rules and the reasoning. **These rules apply to every phase.** Every new module
> must follow the structure described here.

The system is a **modular monolith organized by domain**. Each domain lives in
`src/modules/<domain>/` and owns everything it needs — service, repository, schema, types,
guards, components, hooks, helpers, and tests — behind a single public `index.ts`. Anything
genuinely shared by two or more modules moves up to the shared `src/` layer.

## The 10 rules

1. A component used by only **one** module lives inside that module's `components/` folder.
2. A component used by **two or more** modules lives in `src/components/`.
3. A pure helper used by only **one** module lives inside that module's `lib/` folder.
4. A pure helper used by **two or more** modules lives in `src/lib/`.
5. A type used by only **one** module lives inside that module's types file.
6. A type used by **two or more** modules lives in `src/types/`.
7. All tests live in a `__tests__/` folder. **Never** next to the source file.
8. Every module is imported **only** through its `index.ts`. No deep imports.
9. No module imports from another module's **repository**. Only services.
10. Shared UI components in `src/components/` must have **no domain logic**.

## Shared vs. module-specific — the decision table

The one question that places any file: **is it used by one module, or by two or more?**

| Kind of file            | Used by ONE module                     | Used by TWO OR MORE modules | Rule |
| ----------------------- | -------------------------------------- | --------------------------- | ---- |
| React component         | `modules/<d>/components/`               | `src/components/`           | 1, 2 |
| Pure helper / util      | `modules/<d>/lib/`                      | `src/lib/`                  | 3, 4 |
| Presentation data (labels, groups) | `modules/<d>/lib/`           | `src/lib/`                  | 3, 4 |
| React hook              | `modules/<d>/hooks/`                    | `src/hooks/`                | 1, 2 (by analogy) |
| TypeScript type         | `modules/<d>/<d>.types.ts`              | `src/types/`                | 5, 6 |
| Zod schema              | `modules/<d>/<d>.schema.ts`             | `src/types/` (rare)         | 5, 6 |
| Prisma access           | `modules/<d>/<d>.repository.ts` only    | never shared — go via service | 9 |
| Business logic          | `modules/<d>/<d>.service.ts`            | expose via `index.ts`       | 8, 9 |
| Test                    | `modules/<d>/__tests__/` or `src/lib/__tests__/` | same                | 7 |

> "Two or more modules" means the *domain* modules under `src/modules/`, not the app router.
> The `src/app/` layer is a consumer, not a module; it imports everything through module
> `index.ts` files.

<!-- APPEND_MARKER -->

## Where each kind of file lives

**Inside a module** (`src/modules/<domain>/`):

- `index.ts` — the public API and the **only** import surface for other code.
- `<domain>.service.ts` — business logic and transactions; the sole cross-module entry point.
- `<domain>.repository.ts` — **all** Prisma access for the domain; called only by its service.
- `<domain>.schema.ts` — Zod objects shared by client and server (an *isomorphic leaf*).
- `<domain>.types.ts` — the domain's TypeScript types (an *isomorphic leaf*).
- `<domain>.guards.ts` — pure decision functions, when the domain has them.
- `components/` — the module's own UI (client components live here).
- `hooks/` — the module's own React hooks.
- `lib/` — the module's own pure helpers and presentation data (e.g. label maps).
- `__tests__/` — every test for the module.

**In the shared layer** (`src/`), only what two or more modules use:

- `src/components/` — shared, presentational UI: `ui/` primitives and global `providers/`.
- `src/lib/` — shared, domain-agnostic utilities (dates, money, digits, cn, the db client, sms).
- `src/types/` — shared types and the fixed-enum unions/Zod (`enums.ts`, `enums.schema.ts`).
- `src/hooks/` — shared hooks, if any.
- `src/app/` — routing and thin API handlers; a consumer of modules, never a module itself.

## The public-API rule (rule 8) and why

Every module exposes exactly one entry point, `index.ts`, which re-exports the parts other
code may use — the service functions, the schema/types, and (for server consumers) the module
UI. No other file reaches across a module boundary: no `@/modules/cases/cases.repository`, no
`@/modules/auth/auth.session` from outside `auth`.

Why:

- **Encapsulation.** A module can rename, split, or rewrite its internals freely as long as
  `index.ts` keeps its shape. Consumers never depend on file layout.
- **A single audit surface.** What a module offers — and what it must keep stable — is one
  file, not a scatter of deep import paths.
- **Enforced layering.** Rule 9 (no cross-module repository imports) follows for free: the
  repository simply isn't on the public API, so the only way in is a service function that can
  own the transaction and the authorization.

## The client-component exception (the one exception to rule 8)

A React **client component** (`"use client"`) cannot import a module's `index.ts` when that
barrel transitively re-exports **server-only** code — `node:crypto`, `bcrypt`, the Prisma
client. Next.js follows the whole barrel graph into the client bundle and the build fails on
the `node:` scheme. So, in that **one** case, a client component imports the module's
**isomorphic leaf** directly:

- `login-form.tsx` imports `loginSchema` from `@/modules/auth/auth.schema`.
- `employee-form.tsx` imports the create/update schemas from `@/modules/employees/employees.schema`
  and its types from `@/modules/employees/employees.types`.

These leaves are pure (Zod + TypeScript) and safe on both client and server. Two clarifications:

- **Same-module siblings use relative imports.** A component inside a module imports its
  neighbours directly — `../lib/permission-labels`, `../employees.types` — because that is not
  a cross-*module* import at all.
- **Server code never needs the exception.** Pages, layouts, and route handlers are server
  code, so they import everything — data **and** the module's UI — through the module `index.ts`.
  The barrel re-exports the client components for them; only the client boundary avoids the barrel.

Type-only cross-module references stay on the public API with `import type { X } from "@/modules/<d>"`,
which is erased at build and never pulls runtime code into the client bundle.

## Why this shape — the rationale

- **Portability / future backend separation.** Everything a domain owns sits in one folder. If
  a module ever becomes a separate service, it moves as a unit; the shared layer stays small
  and genuinely cross-cutting, so the seam is already drawn.
- **Testability.** Tests live beside the module they cover, under `__tests__/`, and exercise it
  through the same public API consumers use. Pure guards and helpers are trivially unit-tested
  in isolation; the service is tested against a mocked repository.
- **Clarity.** The shared/module-specific question has one answer (how many modules use it),
  and the folder a file lives in tells you its blast radius at a glance.
- **Correctness by construction.** The service boundary makes "one transaction per multi-step
  operation" and "compute, never store" the natural place to write code, and the `index.ts`
  boundary keeps authorization and transactions from being bypassed by a deep import.

## Applying this to a new module

When a phase introduces a domain (say `cases`):

1. Create `src/modules/cases/` with `index.ts`, `cases.service.ts`, `cases.repository.ts`,
   `cases.schema.ts`, `cases.types.ts`, and `cases.guards.ts` as needed.
2. Put the domain's own UI in `cases/components/`, hooks in `cases/hooks/`, pure helpers in
   `cases/lib/`, and tests in `cases/__tests__/`.
3. Export the public surface — services, schema/types, and any server-imported UI — from
   `index.ts`. Keep the repository off the public API.
4. If a component or helper turns out to be needed by a second module, promote it to
   `src/components/` or `src/lib/` (and a type to `src/types/`) — never deep-import it.
5. Client components import the isomorphic schema/types leaf; server code imports `index.ts`.
