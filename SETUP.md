# SETUP — Kamyab Operations System

> راهنمای نصب و اجرا. این فایل به انگلیسی نوشته شده است. برای توسعه، پایگاه‌داده‌ی
> محلی SQLite است (نیازی به نصب هیچ سروری نیست)؛ نسخه‌ی محصول از PostgreSQL
> استفاده می‌کند.

This guide takes a fresh machine to a running dev server, a passing test suite,
and a production build. Development uses **SQLite** (a local file — no database
server to install). Production uses **PostgreSQL**, configured later via a single
environment variable.

---

## 1. Prerequisites

- **Node.js 20 LTS or newer** (developed on Node 24). Check: `node -v`
- **npm** (ships with Node). Check: `npm -v`
- No database server is required for development.

## 2. Install dependencies

From the project root (`D:\New folder\kamyab`):

```bash
npm install
```

## 3. Configure environment variables

Copy the example file and adjust if needed:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# macOS / Linux
cp .env.example .env
```

`.env` contains:

- `DATABASE_URL` — for development, leave it as `file:./dev.db` (SQLite).
- `SESSION_SECRET` — replace with a long random string. Generate one with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

`.env` is gitignored; `.env.example` is committed as the template.

## 4. Set up the development database (SQLite)

```bash
npm run db:dev:push
```

This creates `prisma/dev.db` and generates the Prisma client for SQLite. See
[How the two databases work](#7-how-the-two-databases-work) for what happens
under the hood.

To browse the dev database in a GUI:

```bash
npm run db:dev:studio
```

## 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000. You should see a right-to-left (RTL) page in the
Vazirmatn font, using the project color palette, showing today's Jalali date and
a sample Toman amount.

## 6. Run the tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

The suite covers the Jalali date utilities (including the day-clamping case:
31 Farvardin + 6 months → 30 Mehr, and leap/common Esfand), the Toman formatter,
and Persian-digit conversion.

## 7. How the two databases work

There is **one** canonical schema: `prisma/schema.prisma`, with
`provider = "postgresql"` (production).

For development, `scripts/prisma-dev.mjs` reads that file, swaps the provider to
`sqlite`, writes a temporary `prisma/schema.dev.prisma` (gitignored), and runs
the Prisma command against the local `prisma/dev.db` file. That is what
`npm run db:dev:push` and `npm run db:dev:studio` do. You never edit the dev
schema by hand, and you never install a database server for development.

To keep both providers compatible, the schema avoids features SQLite cannot
handle. Most importantly, **fixed value sets are modeled as `String` columns
validated by Zod, not as Prisma `enum` blocks** (SQLite does not support enums).
Provider-specific native column types are also avoided.

## 8. Production build

```bash
npm run build
npm start
```

## 9. Switching to PostgreSQL for production (no local install)

You do **not** need PostgreSQL on your development machine. When deploying:

1. Provision a PostgreSQL database with your host/cloud provider (managed
   Postgres, a container, etc.).
2. Set `DATABASE_URL` in the production environment to that connection string:

   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/kamyab?schema=public"
   ```

3. Apply the schema with the canonical (PostgreSQL) schema file:

   ```bash
   npm run db:generate     # prisma generate  (PostgreSQL client)
   npm run prisma:deploy   # prisma migrate deploy
   ```

   (`npm run prisma:migrate` creates migrations during development against a
   real Postgres instance if you ever need to; it is not required for the SQLite
   dev workflow.)

Because the application code and Prisma models are written to the common subset
of both providers, no code changes are needed to switch — only `DATABASE_URL`.

---

## Command reference

| Command | What it does |
|---------|--------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` / `npm run test:watch` | Run unit tests |
| `npm run db:dev:push` | Create/sync the SQLite dev DB + generate client |
| `npm run db:dev:studio` | Browse the dev DB in Prisma Studio |
| `npm run db:generate` | Generate the Prisma client (canonical/Postgres schema) |
| `npm run prisma:deploy` | Apply migrations in production (PostgreSQL) |
| `npm run lint` | Lint |
| `npm run format` | Format with Prettier |
