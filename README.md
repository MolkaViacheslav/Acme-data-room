# Data Room

A secure document repository — nested folders, PDF upload, and read-only
sharing of a data room, a folder, or a single file, by public link or by named
invitation.

| | |
| --- | --- |
| **Web** | <https://acme-data-room-web.vercel.app> |
| **API** | <https://acme-data-room-production.up.railway.app/health> |
| **Demo account** | `demo@acme.test` / `demo-password` |

The demo account starts with a small nested folder tree and no files — upload a
PDF to see the full flow.

---

## What it does

- **Accounts.** Email and password, bcrypt-hashed. Registering creates the
  user, their data room and that room's root folder in one transaction.
- **Folders.** Create, rename, move, delete. Deleting shows the real number of
  folders and files that will go with it, counted server-side.
- **Files.** PDF upload straight from the browser to Supabase Storage, with
  per-file progress, cancel and retry. Rename, move, delete, and an in-app
  viewer over a short-lived signed URL.
- **Browsing.** Breadcrumbs, sortable columns, keyset pagination.
- **Sharing.** A data room, a folder or a single file, either as a public link
  or restricted to named email addresses, with optional expiry and immediate
  revocation. Recipients get a read-only view of the same explorer.

## What it deliberately does not do

Stated plainly, because a half-finished control is worse than an absent one:

- **No email is sent.** "Specific people" records who may open a link; you send
  them the link yourself. The wording in the UI says so.
- **No editor role.** Every share is read-only. The schema and the policy are
  shaped so adding one is a small change, not a migration.
- **No sweeper for abandoned uploads.** A cancelled upload leaves a `PENDING`
  row that no listing shows and that a retry reuses. A production system would
  reconcile these on a schedule.

### One known limitation worth reading before you test sharing

The frontend and the API are deployed as **separate sites**, so the auth cookie
is a third-party cookie. Browsers that block those — Chrome incognito does by
default — accept the sign-in response and discard the cookie.

This affects only flows that need an account:

- **Public links work everywhere**, including incognito. No account, no cookie.
- **Restricted (named) shares need a signed-in recipient**, so in a private
  window with third-party cookies blocked, signing in will not stick. The app
  detects this and says so rather than looping.

Signing in works normally in a regular window in Chrome and Safari, both
verified by hand. The fix is to serve both from one site — see
[docs/DECISIONS.md](docs/DECISIONS.md).

---

## Running it locally

Requires **Node 22+** and **pnpm 11+** (`npm install -g pnpm`).

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in `apps/api/.env` — every variable is documented in the example file:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Supabase → Database → connection string, **pooled** (`:6543`) |
| `DIRECT_URL` | the same, **direct** (`:5432`) — migrations and the seed |
| `JWT_SECRET` | any long random string, e.g. `openssl rand -base64 48` |
| `WEB_ORIGIN` | `http://localhost:3000` |
| `SUPABASE_URL` | Supabase → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys → `service_role` (server only) |
| `SUPABASE_STORAGE_BUCKET` | `data-room-files` — a **private** bucket |

`apps/web/.env.local` needs one: `NEXT_PUBLIC_API_URL=http://localhost:3001`.

Then:

```bash
pnpm --filter @acme/api prisma:migrate   # apply migrations
pnpm --filter @acme/api db:seed          # demo account + a nested folder tree

pnpm dev                                 # both apps
```

Open <http://localhost:3000>.

### Checks

```bash
pnpm typecheck            # both apps
pnpm build                # both apps
pnpm lint                 # both apps
pnpm --filter @acme/api test        # 170 unit tests, no database needed
pnpm --filter @acme/web test        # 22 unit tests
pnpm --filter @acme/api test:e2e    # HTTP layer, Prisma stubbed
pnpm --filter @acme/api test:int    # 57 tests against a real database
```

The integration suite needs `TEST_DATABASE_URL` pointing at an **isolated
Postgres schema** and skips itself entirely when that is absent, so a fresh
clone with no credentials still runs green. It also refuses to start unless it
can prove its own isolation first — it writes a sentinel row and checks the row
landed in the test schema and nowhere else.

---

## Architecture

```
apps/
  api/    NestJS + Prisma          → Railway
  web/    Next.js App Router       → Vercel
                                    Supabase: Postgres + private Storage bucket
```

Two independent deployments. The frontend never talks to Postgres or Storage
directly.

**Uploads bypass the API.** The browser asks for a signed URL and `PUT`s the
file straight to Supabase Storage, so a 50 MB document never occupies a request
slot on the API container — and no Supabase credential is ever shipped to the
browser.

**One place decides access.** Every service method that touches a resource
resolves the caller through `AccessService` first; controllers do HTTP only.
The policy itself is `decideAccess`, a pure function that takes the actor, the
resource, every share in the room, the presented token and the current time —
no database, no clock. That is why 60 tests cover it without any fixtures.

**Read-only comes from the server.** `GET /folders/:id` reports the caller's
role, and the explorer renders controls on that basis. The shared view at
`/share/[token]` is the *same* `ExplorerView` given a token and a link-builder;
it shows no action menu, no upload zone and no "new folder" button because the
API says `VIEWER`, not because a second component was written for it.

---

## Design decisions

The full log, with what each choice traded away, is in
[docs/DECISIONS.md](docs/DECISIONS.md). The ones that shaped everything else:

**A materialized path on `Folder`.** `/rootId/childId/` — indexed, recomputed
when a folder moves. Subtree size, subtree delete and inherited-share checks
are each one indexed query instead of a recursive walk. The bounding slashes
are a safety property, not formatting: without the trailing one `/root/legal`
matches `/root/legalese/`.

**Every data room owns a root folder.** So `File.folderId` is never null, and
`@@unique([folderId, name])` enforces unique names at the top level too —
Postgres treats NULLs as distinct, so a nullable column would have allowed
duplicates there silently.

**404, not 403 — with one deliberate exception.** An actor who may not see a
resource must not learn that it exists. The exception is a caller presenting a
token that exactly matches a real share: they were given that link, so telling
them it was revoked, expired, or addressed to someone else reveals nothing they
did not already hold. The token comparison is constant-time, and the check that
answers "not signed in" runs *before* the resource is looked up — deciding it
afterwards would answer 401 for a real id and 404 for a fake one, which is an
existence oracle.

**Upload limits are enforced against what storage reports.** A signed upload
URL constrains neither size nor content type, so the client's declaration is
only a fast-fail courtesy. On completion the API reads the object's real size
and type, records those, and deletes both row and object on a mismatch. Files
are rendered in an iframe, so a file labelled PDF that is actually HTML would
be an XSS vector — this is load-bearing, not tidiness.

---

## How it scales

### Subtree size and item count

**Today.** One aggregate over the materialized path prefix
(`WHERE path LIKE '/root/a/%'`), backed by the `(dataRoomId, path)` index —
two aggregates in practice, since files carry no path of their own and are
counted through their folder.

**At scale.** A prefix scan over a hot 100k-row drive gets expensive, and these
numbers tolerate slight staleness. Denormalize `descendantCount` and
`descendantBytes` onto `Folder`, updated in the same transaction as the
mutation, or asynchronously through an outbox if write latency matters more
than freshness.

### 100,000 files in one folder

**Cursor (keyset) pagination, never `OFFSET`** — offset degrades linearly as
you page deeper. The cursor is already `(sortKey, id)`, with `id` as the
tiebreaker so the ordering is total and no row can be skipped or repeated.

**Server-side sort and search.** The listing query is covered by
`File(folderId, name)` and `File(folderId, createdAt, id)` so it stays
index-only. Substring search would add a `pg_trgm` GIN index on `name`.

**Virtualized rows on the client**, so the DOM holds a screenful rather than
100,000 nodes. The current explorer paginates but does not virtualize — at a
few hundred rows it does not need to.

**Subtree stats read from the counters above**, not recomputed per render.

### Per-user roles beyond viewer

`Share.role` is already an enum, and the granted role is read off the share
rather than hard-coded — so adding `EDITOR` breaks the build at the single
place that has to decide what an editor may do, instead of silently handing out
read-only access.

Because every permission check funnels through `resolveAccess`, the change is
localized: one enum value, plus write-permission policy inside `decideAccess`,
plus swapping `requireOwner` for a role-aware check on the mutating endpoints.

Conflicting grants resolve **most-specific-wins, then highest-role-wins**: a
share on a file beats one on its folder, which beats one on the data room; if
two grants sit at the same level, the more permissive role applies. The current
loop already returns the first grant it finds because every role is `VIEWER` —
that becomes an explicit comparison when a second role exists.

---

## Data model

See [docs/ERD.md](docs/ERD.md) for the diagram and the reasoning behind each
relationship.

## AI usage

Built with Claude Code, driven phase by phase against
[docs/PLAN.md](docs/PLAN.md). Each phase was scoped and approved before
implementation, and the full account — including what it got wrong and how that
was caught — is in [docs/AI_USAGE.md](docs/AI_USAGE.md).
