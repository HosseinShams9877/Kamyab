# Recommended Technology Stack

> The stack below is **mandated** by the project brief. This document records each choice and the reason it fits this system, plus the supporting libraries chosen to satisfy the document's hard requirements (Jalali dates, RTL, Persian typography, dual validation).

## Mandated core

| Layer | Choice | Why it fits this system |
|-------|--------|--------------------------|
| Framework | **Next.js (latest), App Router** | One codebase for server-rendered pages and API routes; server components let access control and data-fetching live on the server, directly supporting "access control on the server, not by hiding buttons" ([07-critical-rules.md](../knowledge/07-critical-rules.md), rule 3). |
| Language | **TypeScript** | The domain has many fixed enums (statuses, roles, priorities) and exact glossary names; a type system enforces them at compile time and prevents the naming drift rule 8 warns against. |
| Styling | **Tailwind CSS** | The brief fixes an exact palette, radii, and shadow scale; expressing them as Tailwind tokens makes the design system enforceable and consistent, with first-class RTL support. |
| Client data | **React Query (TanStack Query)** | Caching, background refetch, and mutation invalidation fit a system full of computed-on-read values (balance, counts) that must refresh the moment their source changes. |
| Database | **PostgreSQL** | Transactions (mandatory for the multi-step operations in rule 4), rich constraints (the "once" uniqueness guarantees of rule 5), and partial/composite indexes the workload needs. |
| ORM | **Prisma (mandatory)** | Typed schema and client, first-class migrations, and `$transaction` for the atomic operations; the schema doubles as living documentation of the model. |

## Architecture constraints (from the brief)

- **Business logic in a separate `services/` folder** — not in components, not in API route handlers. Route handlers stay thin: parse, authorize, call a service, shape the response. See [folder-structure.md](folder-structure.md).
- **Validation on both client and server** — the same schema runs in the browser (fast feedback) and on the server (the real gate).
- **Access control on the server** — every mutating route and scoped query re-checks permission independently of the UI.

## Supporting libraries (recommended, to meet hard requirements)

| Need | Recommended library | Reason |
|------|---------------------|--------|
| Jalali dates & math | **dayjs** with the `jalaliday` (or equivalent Jalali) plugin, or a dedicated Jalali date library | The document requires expiry computed on the Jalali calendar with month-based addition and last-day clamping — never `+365 days`. A calendar-aware library makes rule 10 correct and testable. |
| Validation (shared) | **Zod** | One schema object validates on both client and server, satisfying the dual-validation requirement without duplicating rules; infers TypeScript types too. |
| Auth / sessions | **Auth.js (NextAuth)** credentials provider, or a lightweight custom session | Fits the mobile+password, 12-hour session, and inactive-user-rejection rules; sessions are server-verified. |
| Password hashing | **bcrypt** (or argon2) | Passwords are stored hashed; the manager can set but never see them (C-12). |
| Forms | **React Hook Form** + the Zod resolver | Ergonomic forms with the same Zod schemas used server-side; handles the live-behavior requirements of the case form (C-4). |
| Typography | **Vazirmatn** (self-hosted) with IranSans fallback | The brief fixes the font; self-hosting avoids a CDN dependency and keeps Persian glyph rendering consistent. |
| Persian digits & money | small in-house util (Phase 1) | Formatting integer Toman with a 3-digit separator and Persian digits is specific enough to own directly and unit-test. |
| SMS gateway | a thin **adapter interface** + a provider client | The provider is manager-selected in settings (B-10); an adapter keeps provider choice out of the business logic and honors the real-send safety key. |

## Deliberately outside the app

- **The scheduler** (cron on Linux / Task Scheduler on Windows) invokes the automatic engine. It is the one required external setting; without it no SMS, greeting, or auto-archive happens (C-14). This must be prominent in the install docs.
- **Accounting** (official invoices, tax, legal ledgers) is explicitly out of scope (C-7); the financial card is operational, not an accounting system.

## Versioning and safety notes

- Pin dependency versions (exact or tight ranges) so a fresh install is reproducible.
- Keep secrets (database URL, SMS API key, session secret) in environment variables, never in the repo. The SMS API key is treated as a secret and is not echoed back after saving (B-10).
