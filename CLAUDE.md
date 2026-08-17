# Data Room — Project Rules

Read this file before every task. Read `docs/PLAN.md` for the current phase and
mark checkboxes there as you complete work.

## What we are building

A Data Room MVP: a secure document repository (think Google Drive scoped to one
acquisition). Nested folders, PDF upload, and read-only sharing of a data room,
a folder, or a single file — via public link or per-user permission.

This is a take-home assignment. It is graded, in this order:

1. **UX and functionality** — intuitive flows, edge cases and error states handled
2. **Design and polish** — clean UI, and *no unimplemented features visible*
3. **Code quality and readability**

Optimize in that order. A polished narrow app beats a broad broken one.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | Supabase Postgres |
| File storage | Supabase Storage (private bucket, signed URLs only) |
| Auth | Email + password, JWT in httpOnly cookie, issued by NestJS |
| Deploy (FE) | Vercel |
| Deploy (BE) | Railway |

Repo layout:

```
/apps
  /web        Next.js frontend
  /api        NestJS backend (Prisma schema lives here)
/docs
  PLAN.md     phased execution plan
  ERD.md      data model
README.md
```

Two separate deployments. Do not collapse the backend into Next.js route
handlers — the assignment expects a real backend deployed independently.

## Hard rules

**TypeScript**
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No non-null assertions (`!`) except in code paths already guarded above.
- Shared request/response types live in `apps/web/src/lib/api/types.ts`, kept in
  sync with backend DTOs by hand. Do not build a codegen pipeline.

**Backend**
- Controllers do HTTP only: parse, validate, delegate, return. All business
  logic lives in services.
- Every request body is a DTO class with `class-validator` decorators.
  `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` globally.
- Never trust a client-supplied `dataRoomId` / `folderId` / `fileId`. Every
  service method that touches a resource must first resolve access for the
  current actor. One shared `AccessService` owns this logic — do not scatter
  ownership checks across controllers.
- Errors: throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`,
  `ConflictException`). Return `404` rather than `403` when the actor should not
  even know the resource exists.
- No raw SQL except where the plan explicitly calls for it (subtree queries).

**Frontend**
- Granular components. The assignment names this explicitly. A file/folder row,
  a breadcrumb, an upload item, a share row are each their own component in
  their own file. Nothing over ~150 lines.
- Server Components by default; `'use client'` only where interactivity requires it.
- Data fetching: TanStack Query on the client for anything mutable (folder
  contents, shares). Optimistic updates for rename, move, delete.
- Every mutation has three visible states: pending, success, error. Errors
  surface as a toast with a human message, never a raw stack or `[object Object]`.
- Every list has an empty state and a loading skeleton. No bare spinners on a
  blank page.
- Destructive actions use a confirmation dialog that states *exactly* what will
  be deleted (e.g. "This will delete 3 folders and 12 files permanently").

**Scope discipline**
- Do not add features that are not in `docs/PLAN.md`.
- Do not ship a button, menu item, or empty page for something not implemented.
  A disabled "Coming soon" control counts as an unimplemented feature and loses
  points. Delete it instead.
- If you think something is missing from the plan, add it to the "Open
  questions" section at the bottom of `docs/PLAN.md` and keep going. Do not
  silently expand scope.

## Commands

```bash
# api
cd apps/api
pnpm start:dev
pnpm prisma migrate dev --name <name>
pnpm prisma studio

# web
cd apps/web
pnpm dev
```

## Working style

- Work phase by phase. Finish and verify one phase before starting the next.
- After each phase: run typecheck and build on both apps. Do not leave a broken
  build behind you.
- Commit at the end of every phase with a conventional-commit message.
- When an external API contract matters (Supabase signed upload URLs, Prisma
  syntax, NextAuth), check current docs rather than relying on memory — these
  change often.
- When you make a non-obvious decision, append one line to
  `docs/DECISIONS.md`: what you chose, and what you traded away. This file
  becomes the README's design-decisions section.
- Log AI usage as you go in `docs/AI_USAGE.md` (the assignment requires this).
