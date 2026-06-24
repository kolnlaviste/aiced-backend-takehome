# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Next.js dev server (http://localhost:3000)
pnpm build        # Production build
pnpm db:reset     # Apply all migrations in supabase/migrations/ (in filename order) to DATABASE_URL
pnpm test         # Run full Vitest suite
pnpm test -- --reporter=verbose   # Run tests with detailed output
```

Run a single test file:
```bash
pnpm test tests/notes.test.ts
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in three variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (used in API routes) |
| `DATABASE_URL` | PostgreSQL connection string (used by `db:reset` and tests) |

You can use either a Supabase cloud project or local Supabase via `supabase start` (requires Docker + Supabase CLI).

## Architecture

### Multi-Tenant RLS Pattern

Row-Level Security in the database is the **authoritative enforcement layer** — not application code. The flow for every API request:

1. Client sends `Authorization: Bearer <JWT>` header
2. API route creates a per-request Supabase client via `createUserClient(req)` in `lib/supabase.ts`
3. The client forwards the JWT; Supabase runs RLS policies using `auth.uid()` from the token
4. Only rows visible to that user are returned — the application layer never filters manually

**Never use the service-role key in API routes** — this bypasses RLS entirely.

### Data Model

Seeded tenants, users, and memberships in `supabase/migrations/0001_init.sql`:

| Table | Purpose |
|---|---|
| `groups` | Tenants (Acme `111...`, Globex `222...`) |
| `users` | App users (Alice `aaa...` → Acme, Bob `bbb...` → Globex, Carol `ccc...` → both) |
| `memberships` | Many-to-many join: which users belong to which groups |
| `documents` | Example tenant-scoped feature table with RLS enabled |

RLS policies on feature tables should join through `memberships` to check that `auth.uid()` belongs to the same `group_id` as the row.

### Test Harness

`tests/helpers.ts` exposes:

- `pool` — a `pg.Pool` connected to `DATABASE_URL`
- `asUser(userId, fn)` — wraps a callback in a transaction that sets `request.jwt.claims` so PostgreSQL's `auth.uid()` returns that user's ID. Rolls back after to prevent state leakage.
- `asOwner(fn)` — runs without RLS (useful for seeding data in tests)
- Pre-set UUIDs for Alice, Bob, Carol and the Acme/Globex groups

See `tests/documents.example.test.ts` for the canonical pattern to follow.

### API Route Pattern

API routes live in `app/api/<feature>/route.ts`. Each route:
1. Calls `createUserClient(req)` to get an RLS-scoped Supabase client
2. Uses Zod to validate request body (POST) or query params (GET)
3. Returns typed JSON responses with appropriate HTTP status codes

### Migrations

SQL files in `supabase/migrations/` are applied in filename (alphabetical) order by `scripts/db-reset.mjs`. Name new migration files with an incremented prefix: `0002_notes.sql`, `0003_...`, etc.
