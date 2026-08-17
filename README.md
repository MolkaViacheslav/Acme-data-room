# Data Room

A secure document repository — nested folders, PDF upload, and read-only
sharing of a data room, a folder, or a single file.

> **Status: Phase 0 of `docs/PLAN.md`.** The deployment skeleton is in place;
> no product features are implemented yet. This README grows with the project
> and is finalised in Phase 8.

## Stack

| Layer        | Choice                                             |
| ------------ | -------------------------------------------------- |
| Frontend     | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend      | NestJS + TypeScript                                |
| ORM          | Prisma                                             |
| Database     | Supabase Postgres                                  |
| File storage | Supabase Storage (private bucket, signed URLs)     |
| Deploy       | Vercel (web) + Railway (api)                       |

## Layout

```
apps/
  api/    NestJS backend — Prisma schema lives here
  web/    Next.js frontend
docs/
  PLAN.md       phased execution plan
  DECISIONS.md  design decisions and their tradeoffs
  AI_USAGE.md   how AI was used on this project
```

## Local setup

Requires Node 22+ and pnpm 11+ (`npm install -g pnpm`).

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# fill in the values described in each file

pnpm dev            # both apps
pnpm dev:api        # api only  → http://localhost:3001
pnpm dev:web        # web only  → http://localhost:3000
```

Open <http://localhost:3000> — it calls `GET /health` on the API and reports
whether the connection works.

## Checks

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm --filter @acme/api test
```
