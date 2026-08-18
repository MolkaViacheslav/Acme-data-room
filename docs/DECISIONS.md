# Design decisions

One line per non-obvious choice: what was chosen, and what it traded away.
This file feeds the README's design-decisions section.

## Phase 0 — Skeleton + deploy pipeline

- **pnpm workspace over Turborepo/Nx.** Two apps that never import each other
  need no build graph. Traded away remote caching and task orchestration, which
  would be dead weight at this size.
- **Env is validated once at boot (`apps/api/src/config/env.ts`) rather than
  read ad hoc.** A misconfigured deploy fails immediately with a message that
  names the variable. Traded away the convenience of `process.env.X` at call
  sites, and it means every new variable needs a line in the loader.
- **Only variables the code actually uses are required.** `.env.example`
  documents the full eventual set with the phase that introduces each one, so
  the API boots and `/health` is verifiable before Supabase exists. Traded away
  a single all-or-nothing env contract.
- **CORS origins come from a comma-separated `WEB_ORIGIN` allowlist, and `*` is
  rejected at boot.** Credentialed CORS cannot use a wildcard, so failing early
  beats debugging a silent cookie drop in the browser. Traded away the
  flexibility of regex/pattern origins, e.g. Vercel preview deployments — each
  preview URL that needs API access must be added explicitly.
- **`apiFetch` converts transport failures into an `ApiError` with a human
  sentence.** `TypeError: fetch failed` never reaches a user-visible surface.
  Traded away the raw cause at the UI layer; the underlying error is still
  visible in server logs.
- **The health page is `force-dynamic`.** Its whole purpose is to prove the
  *deployed* frontend can reach the *deployed* API, which a build-time
  prerender would not show. Traded away static generation of the landing page.
- **Railway builds from the repo root, not from `apps/api`.** The pnpm
  workspace and lockfile live at the root, so a root-scoped install keeps
  `--frozen-lockfile` honest. Traded away a smaller build context.

## Phase 0 — deployment

Live: web on <https://acme-data-room-web.vercel.app>, API on
<https://acme-data-room-production.up.railway.app>.

- **Vercel's project root is `apps/web`, Railway's is the repo root.** The
  frontend only needs its own app directory; the API needs the workspace
  lockfile above it. Traded away a symmetric configuration between the two
  platforms, which is a recurring source of confusion.
- **pnpm is activated explicitly via Corepack in the Railway build.** The build
  image failed with `pnpm: not found` — a `packageManager` field in the root
  `package.json` was not by itself enough to put pnpm on `PATH`. Fixed by
  prefixing the build with `corepack enable && corepack prepare
  pnpm@11.22.0 --activate`. The fix was applied in the Railway dashboard first
  and is now encoded in `railway.json`, so the repository describes its own
  build rather than depending on dashboard state a reviewer cannot see. Traded
  away a single source for the pnpm version: it is now pinned both in
  `packageManager` and in the build command, and the two must move together.
- **CORS was verified from the browser, not only from the server.** The status
  page is a Server Component, so its fetch runs on Vercel's Node runtime and
  never exercises CORS. A `fetch(..., { credentials: 'include' })` from the
  Vercel origin in DevTools is what actually proves the allowlist works — which
  is the check that matters, since every authenticated call from Phase 2 onward
  is browser-originated.

## Phase 1 — Data model

- **Connection URLs live in `prisma.config.ts`, not `schema.prisma`.** Prisma 7
  removed `url` and `directUrl` from the datasource block. This turned out to
  suit Supabase: the config file is only read by the CLI, so it points at the
  **direct** connection (`:5432`) that migrations need, while the application
  connects over the **pooled** one (`:6543`). Traded away having one place to
  look for the connection string.
- **`@prisma/adapter-pg` rather than a bare client.** Prisma 7 removed
  `datasourceUrl` and requires a driver adapter unless you use Accelerate.
  Traded away nothing we wanted; it does add `pg` to the dependency tree.
- **`rootDir` is pinned in `tsconfig.build.json`.** With `prisma.config.ts` at
  the app root, TypeScript infers a root of `.` and emits `dist/src/main.js`,
  which `start:prod` would not find — a deploy that builds green and dies on
  boot. Traded away nothing; it just has to be explicit.
- **`incremental` is off for the build config.** `nest-cli.json` sets
  `deleteOutDir`, and the two together silently produce an empty `dist`: tsc
  sees unchanged inputs and emits nothing into the directory it just wiped.
  Traded away a slightly faster rebuild.
- **The generated client is gitignored and rebuilt by `build`/`typecheck`.**
  Keeps generated code out of review diffs. Traded away the ability to run
  `tsc` on a fresh clone without first having database credentials, since
  `prisma generate` loads `prisma.config.ts` and resolves `DIRECT_URL` eagerly.
- **`bcryptjs` instead of native `bcrypt`.** Same hash format, no native
  compilation step in the Railway build — one fewer way for a deploy to fail.
  Traded away hashing speed, which is irrelevant at this login volume.
- **Ids are generated in the seed rather than by the database.** Lets each
  folder's materialized path be built in a single pass without reading rows
  back. Traded away relying on the schema's `@default(uuid())` there.
- **The seed creates folders but no files.** A `File` row asserts that an
  object exists in Supabase Storage behind it, and nothing uploads objects
  until Phase 5 — seeded rows whose downloads 404 would be worse than an empty
  folder. Traded away a richer-looking demo until upload lands.
- **The e2e test stubs `PrismaService` instead of connecting.** `/health` must
  answer without a database, the suite should run on a machine with no
  credentials, and Prisma 7 loads its query compiler through a dynamic
  `import()` that Jest cannot execute without `--experimental-vm-modules`.
  Traded away end-to-end coverage of the database wiring, which is instead
  proven by booting the built server against Supabase.
- **Jest maps `./x.js` imports back to `./x`.** The generated client uses
  extensioned relative imports, which TypeScript resolves and Jest does not.
  Traded away nothing; it is two lines in each Jest config.
- **The seed deletes and recreates only the demo account.** Re-running it is
  safe and leaves any other data alone. Traded away preserving demo data
  between runs.

## Phase 2 — Auth

- **A hand-written `JwtAuthGuard` rather than Passport.** The token arrives in a
  cookie, not an `Authorization` header, so `passport-jwt`'s extractors buy
  nothing here — three dependencies replaced by forty lines that are fully
  typed. Traded away the familiarity of a standard strategy.
- **The guard is global; routes opt out with `@Public()`.** A new endpoint is
  protected because someone did nothing, rather than unprotected because
  someone forgot a decorator. Traded away nothing.
- **Cookie attributes live in one file, `auth/cookie.ts`.** They are the part
  of auth most likely to need changing — the plan's own fallback is to abandon
  cookies for a bearer token if Safari blocks them — so they should be one
  edit, not a search across the codebase.
- **`SameSite=None; Secure` in production, `Lax` locally.** Vercel and Railway
  are different sites, and browsers only accept `SameSite=None` together with
  `Secure`. Locally both apps are on `localhost`, which is same-site regardless
  of port, and `Secure` would break plain HTTP. Traded away a single
  configuration for both environments.
- **`app.set('trust proxy', 1)`.** Railway terminates TLS ahead of the app, so
  without it Express sees plain HTTP and silently declines to set a `Secure`
  cookie.
- **The cross-site cookie was verified in a browser, and the bearer-token
  fallback was not needed.** This was the risk the plan called out: Vercel and
  Railway are different sites, and Safari's Intelligent Tracking Prevention was
  the specific worry. Signing in and reloading kept the session in both Chrome
  and Safari with cross-site tracking prevention left on, so the plan's fallback
  — a bearer token held in memory plus a refresh endpoint — was not
  implemented. `auth/cookie.ts` still isolates the attributes, so adopting the
  fallback later would be one file.
- **Login answers identically for an unknown email and a wrong password, and
  hashes a dummy value when no user matched.** Otherwise both the message and
  the response time would reveal which addresses are registered.
- **Registration relies on the unique index, not a pre-check.** Two
  simultaneous registrations both pass a `findUnique` guard; only the
  constraint actually decides. The `P2002` error is translated into a 409.
- **`/auth/me` returns the user's data room alongside the user.** The landing
  page needs both, and inventing a second endpoint for one name would be worse.
  Traded away a strictly minimal auth payload.
- **The session is resolved client-side, and there is no `middleware.ts`.** The
  auth cookie belongs to the API's origin, so nothing running on Vercel can
  read it. See "Open questions" in `PLAN.md`. Traded away an edge-side
  redirect: a protected route shows its skeleton for one round trip first.
- **Environment is parsed once into an injected `APP_ENV` provider.** The
  previous shape re-read and re-validated `process.env` on every request that
  needed a cookie option. Traded away the ability to change configuration
  without a restart, which is not something we want anyway.
- **Integration tests address the test schema through the adapter's `schema`
  option, not `?schema=` in the URL.** `?schema=` is a Prisma CLI convention;
  the `pg` driver behind the adapter ignores unknown query parameters. Getting
  this wrong pointed the destructive suite at `public` and deleted the seeded
  demo account, so the suite now proves its own isolation before it will run:
  it writes a sentinel row and refuses to continue unless that row landed in
  the test schema and nowhere else. Traded away a shorter setup.

## Phase 3 — AccessService

- **The authorization decision is a pure function, `decideAccess`.** It takes
  the actor, the resource, every share in the room, the presented token and the
  current time as arguments — no database, no clock, no injection. Every branch
  of the policy is therefore reachable from a test without infrastructure,
  which is why this phase has 39 tests and no fixtures. `AccessService` is
  reduced to fetching inputs. Traded away the convenience of querying
  mid-decision: the service must load all shares for the room up front rather
  than short-circuiting.
- **Denials carry a typed reason.** `NONE` alone would let the revoked-share
  test pass when the share was merely missing. The reason also gives Phase 7
  what it needs to tell "revoked" from "expired" without a second query.
  `AccessService.requireAccess` deliberately drops it and answers a bare 404.
- **404, never 403.** An actor who may not see a resource must not learn that
  it exists, so a missing resource and a forbidden one are indistinguishable
  from outside.
- **The granted role is read off the share rather than hard-coded.** Both are
  `VIEWER` today, so this changes nothing now — but it means adding `EDITOR` to
  the enum fails to compile at the one place that has to decide what an editor
  may do, instead of quietly granting them read-only access.
- **Revocation ignores the clock.** Any `revokedAt` at all means revoked, rather
  than `revokedAt <= now`. Comparing against the clock would leave a window in
  which a revoked share still worked, and revocation is supposed to be
  immediate. Traded away scheduled revocation, which is not a feature.
- **A share expiring exactly now is expired.** An arbitrary choice, but an
  explicit and tested one rather than an accident of `<` versus `<=`.
- **Malformed paths match nothing rather than being repaired.** Ancestry is a
  prefix test over the materialized path, and the trailing slash is the entire
  safety property — without it `/root/legal` matches `/root/legalese/` and
  leaks a sibling subtree. A path missing its bounding slashes is rejected
  outright. Traded away tolerance of bad data, deliberately.
- **A folder share does not grant the data room entity.** Sharing the root
  folder shares its contents, not the room itself. Strictness costs nothing
  here and the alternative is a quiet escalation.
- **Tokens are compared in constant time**, with a small inline loop rather
  than `crypto.timingSafeEqual`, so the decision function keeps no imports.
  The comparison leaks length, which is fine — tokens are fixed width.
- **Shares are scoped by data room twice**: once in the query, and again inside
  the decision function. The second check is redundant today and is there so
  that a future change to the query cannot silently open a cross-room hole.
- **Folder paths for folder shares come from a second query, filtered by data
  room as well as by id.** `Share` is polymorphic and has no foreign key to
  join through. The extra `dataRoomId` filter stops a share from importing a
  path belonging to another room's folder.

## Phase 4 — Folders & files API

- **`AccessService.requireOwner` is the single write threshold.** Every mutation
  calls it rather than testing `decision.role` inline, so "who may write" stays
  one rule in one file. It answers **403**, not 404: a viewer can already read
  the resource, so hiding it would only confuse. The 404 rule protects actors
  who should not know the resource exists, and `requireAccess` has applied it
  before `requireOwner` is reached.
- **Endpoints taking two client-supplied ids resolve access twice.** `move`
  checks the thing being moved *and* the destination. Checking only the first
  would let anyone drop their own file into someone else's folder.
- **The materialized-path rule now lives in one module.** `decideAccess` used to
  carry its own copy of the prefix check; `shared/materialized-path.ts` is now
  the only definition, used by both the security boundary and the folder logic.
  Duplicating a rule whose trailing slash prevents a subtree leak was the wrong
  kind of independence.
- **Breadcrumbs are truncated to what the caller may know.** A recipient of a
  share on a nested folder sees the chain from that folder down; the names of
  folders above it are not theirs. Costs one extra query for viewers only.
  The plan asked for a breadcrumb "derived from path" and did not mention this,
  but shipping the untruncated version would leak folder names in Phase 7.
- **Children are listed folders-first behind a single cursor.** They live in two
  tables, and keyset pagination cannot span both without raw SQL. Ordering
  folders ahead of files makes each page one indexed keyset query against one
  table. Traded away: sorting by size cannot interleave folders with files, so
  folders keep name order under that sort.
- **Keyset pagination, never OFFSET.** Offset re-reads and discards every skipped
  row, so deep pages cost proportionally more. The cursor carries the sort value
  plus the row id as a tiebreaker, which keeps the ordering total.
- **A malformed cursor is a 400, not a crash or a silent first page.** It is a
  position, not a permission — tampering can only produce a wrong page.
- **The root folder cannot be renamed, moved or deleted.** It represents the data
  room: deleting it would leave `DataRoom.rootFolderId` null, which
  `AccessService` already treats as an unusable room. Refusing outright beats
  supporting it halfway.
- **Subtree paths are rewritten with one `update` per row inside a transaction.**
  A single `UPDATE … SET path = replace(...)` would be one round trip instead of
  N, but the plan restricts raw SQL to subtree *queries*. Traded away: moving a
  folder with thousands of descendants is slower than it needs to be. Worth
  revisiting if the numbers ever justify it.
- **Storage cleanup runs after the database work and never fails the request.**
  An orphaned object costs storage; a rolled-back delete costs correctness. The
  keys are collected before the cascade removes the rows that name them.
- **Conflicts answer 409 with a suggested free name.** The plan asked for this on
  file rename only; folders got it too, because the client can then offer
  "rename to Legal (2)" instead of making the user guess.
- **Integration suites run serially.** Two of them share one test schema, and in
  parallel each one's cleanup deleted the other's fixtures. `maxWorkers: 1` in
  the integration Jest config.

## Phase 5 — Upload

- **The browser uploads straight to Supabase Storage; the bytes never reach
  Railway.** The API only signs a URL. A 50 MB file would otherwise occupy a
  request slot on a small container for the length of the transfer.
- **No Supabase SDK, and no Supabase key, in the browser.** The signed URL comes
  from our own API with the token already embedded, so the frontend does a plain
  `PUT` to a URL it was handed. One fewer credential to think about.
- **`XMLHttpRequest`, not `fetch`.** `fetch` cannot report upload progress —
  there is no request-body stream to observe — so a progress bar over it would
  be an animation, not a measurement. Traded away: a little more ceremony
  around cancellation, which `AbortSignal` still drives.
- **Limits are enforced against what storage reports, not what the client
  claimed.** A signed upload URL constrains neither size nor content type, so
  the declared values are only a fast-fail courtesy. `complete` reads the
  object's real size and type, records those, and deletes both row and object on
  a mismatch. This is load-bearing rather than tidy: Phase 6 renders these files
  in an iframe, so a file labelled PDF that is actually HTML would be an XSS
  vector. Proved with a test that uploads `<script>alert(1)</script>` through a
  URL signed for a PDF and asserts the object is gone afterwards.
- **An abandoned `PENDING` row is reused rather than collided with.** The unique
  constraint is `(folderId, name)` regardless of status, so a failed upload of
  `report.pdf` would otherwise make every retry conflict with a row that no
  listing shows and no user can delete. Recorded under "Open questions" that a
  production system would also sweep these on a schedule.
- **A name conflict is resolved server-side instead of answered with a 409.**
  Dropping ten files should not stop on the one that clashes; the response says
  which name was actually taken, and the queue shows "uploaded as report (2).pdf"
  when it differs.
- **Cancelling deletes the reserved row.** Otherwise the cancelled name would
  stay taken by an invisible row — the same trap as above, reached a different
  way.
- **The upload panel takes `folderId` as a prop and nothing else.** It sits on
  the temporary landing page today and moves into the explorer in Phase 6
  without changes.

## Phase 6 — Explorer UI

- **"Share" is not in the row action menu.** `PLAN.md` lists it there, but
  sharing lands in Phase 7, and `CLAUDE.md` forbids shipping a control for
  something unimplemented — a disabled "coming soon" item costs points in the
  category this phase is judged on. The menu has Open, Rename, Move, Delete;
  Share joins it with its dialog. This is the one place Phase 6 knowingly
  departs from the letter of the plan.
- **The temporary landing page was deleted, not kept alongside.** `/` now
  resolves the session and redirects to the caller's root folder. Two screens
  showing the same data room would be exactly the kind of half-finished surface
  the grading rubric punishes.
- **Every control is gated on `folder.role`.** `GET /folders/:id` has returned
  the caller's role since Phase 4, so a viewer sees no action menu, no upload
  panel and no "New folder" button — rather than controls that answer 403.
  Phase 7's read-only shared view therefore needs no separate implementation.
- **Sorting lives in the URL (`?sort=&dir=`), not component state.** Back
  behaves, and a link carries the view it was copied from. Traded away: sorting
  resets when navigating to a folder through a link that omits the parameters.
- **Folders show `—` for size, not `0 B`.** A folder has no size of its own —
  the listing sorts them by name under a size sort, as Phase 4 established, and
  claiming zero bytes would be a small lie in a table people read for facts.
- **Explicit "Load more" rather than infinite scroll.** The cursor makes either
  possible; a button is predictable, keyboard-reachable, and never fights the
  scroll position. Traded away a little polish on very long folders.
- **The move dialog computes the blocked subtree client-side.** The tree is
  built top-down, so every node already knows its ancestors — no API change was
  needed to grey out the folder being moved and everything under it. The server
  enforces the same rule through the path prefix; the client copy exists to
  explain, not to protect.
- **Blocked destinations are shown greyed out with a reason, not hidden.** A
  folder that silently disappears from a picker reads as a bug.
- **Rename is optimistic against a full snapshot of the listing.** Name
  collisions are common enough that the revert has to restore exactly what was
  there, and the 409's `suggestedName` goes straight into the toast.
- **The PDF viewer never reuses a cached signed URL** (`staleTime: 0`,
  `gcTime: 0`). The link is deliberately short-lived, so a cached one is more
  likely expired than useful; reopening asks for a fresh one.
- **The viewer takes a file id and nothing else**, like the upload panel before
  it, so Phase 7 can drop it onto a shared-file page unchanged.
- **Sorting uses `push`, not `replace`.** The first implementation replaced the
  history entry, so the Back button never became available — the opposite of
  the reason for putting sort in the URL at all. Each sort is now a step Back
  can undo.
- **The sign-in page waits for the session before rendering its form.** It used
  to render immediately and redirect once the session resolved, which showed
  anyone already signed in a flash of the login page — most visibly when
  arriving from the Back button. Traded away: a signed-out visitor sees a
  placeholder for the length of one request.
- **Queries are stale after 15 seconds rather than immediately.** The default
  of zero meant every dialog open and every step back paid for a round trip
  that had already happened — about 270 ms each from Europe to the API. Every
  mutation still invalidates what it touched, so the only staleness this can
  expose is another session's change.
- **Re-sorting keeps the previous rows on screen** (`keepPreviousData`).
  Changing the sort changes the query key, which otherwise blanked the table to
  a skeleton and made a reorder look like a reload.

## Phase 7 — Sharing

- **A refusal names its reason only to someone holding the exact token.** A
  caller presenting a token that matches a real share gets 410 `REVOKED`, 410
  `EXPIRED`, 401 `SIGN_IN_REQUIRED` or 403 `NOT_INVITED`; everyone else gets a
  bare 404. They were given that link, so telling them it no longer works
  reveals nothing they did not already hold — while a stranger still cannot use
  the endpoint to discover which resources exist. The token comparison is
  constant-time, so this cannot be turned into an oracle. Tested from both
  sides: the four disclosures, and the silence for no token, a wrong token, and
  a wrong token of the right length.
- **Anonymous with no token is 401, not 404.** Such a caller could not be
  granted anything by any rule, so the answer says nothing about the resource —
  and it is what lets the frontend offer sign-in instead of "not found" to
  someone whose session simply lapsed.
- **`JwtAuthGuard` now attempts authentication on `@Public()` routes** instead
  of skipping the cookie entirely, and can never throw while doing so. Without
  it an invited recipient who *is* signed in would look anonymous on a public
  route and fail the restricted-share check. Verified against the existing
  public routes: `/health`, login, register and logout all ignore
  `request.user`, and logout still works with a dead cookie.
- **Every share carries a token, including restricted ones.** The token is the
  share's address — `/share/<token>` is how anyone reaches it. What it *means*
  differs: for a public link it is the credential, for a restricted share it
  only identifies which share is being opened, and `decideAccess` never
  consults it in that mode. This corrects the Phase 1 schema comment.
- **Sharing the root folder creates a `DATA_ROOM` share, not a `FOLDER` one.**
  Phase 3 decided deliberately that a folder share does not grant the data room
  as an entity; without this the enum value would never be produced by any path
  through the UI.
- **`/share/[token]` renders the same `ExplorerView` as the owner's drive**,
  given one extra prop: a token and a function that builds folder links. It is
  read-only because the API reports the caller's role as `VIEWER` and the
  explorer hides controls on that basis — the gate built in Phase 6. No
  second implementation, and no `isShareView` flag to keep in sync.
- **The token is part of every query key.** The owner's view of a folder and a
  guest's view of the same folder are different answers and must not share a
  cache entry.
- **`?next=` accepts same-site paths only.** Rejecting anything starting with
  `//` or a scheme keeps the sign-in detour from becoming an open redirect.
- **A fifth edge case was added to the plan's four.** Someone signed in as an
  account the link does not name used to fall through to a bare 404. They hold
  the link, so under the disclosure rule above they are told it was addressed
  to a different email — a realistic case when a recipient forwards a link.
- **The "anonymous with no credentials" check runs before the resource is even
  looked up.** Placed after it — as it first was — the API answered 401 for an
  id that exists and 404 for one that does not, handing anyone not signed in an
  oracle for whether a resource exists. That is precisely what the 404 rule is
  for, so the check moved ahead of the lookup and a regression test asserts both
  answers are byte-identical. Found by probing the deployed API rather than by
  reading the code.
- **A held link only explains itself when it actually covers what was asked
  for.** `refuse()` first looked only at whether the presented token matched a
  real share, so an invited recipient who navigated outside the shared subtree
  was told "this link was shared with a different email address" — untrue, and
  confusing. It now falls through to a plain 404 whenever the decision reason is
  `NO_MATCHING_SHARE`. Caught by the sequence test written for the invited-user
  journey, which is exactly why that test was written as a sequence rather than
  as separate cases.
- **`?next=` is parsed in one place, `lib/auth/next-path.ts`.** It was worked
  out separately in the sign-in form and the auth gate, and the sign-up form did
  not do it at all — so following a share link and choosing "create one" dropped
  the destination and landed the new account in its own empty drive. The
  switch-link between sign-in and sign-up now carries it too.
- **A 401 in the explorer redirects to sign-in rather than rendering.** It used
  to show "Could not open this folder — You are not signed in", which reads as a
  failure when it is an instruction, and left no way forward.
- **A 401 wins over cached session data.** React Query keeps the last
  successful value when a refetch fails, so `useSession()` could report a
  signed-in user *and* a 401 at the same moment. `AuthGate` redirected on "there
  is a user" while the explorer redirected on "not authorised", and the two
  bounced against each other — a navigation loop re-requesting `/auth/me` and
  the folder listing about once a second, indefinitely. `useSession` now
  resolves to a single answer, and a 401 anywhere else drops the cached session
  so the whole app converges on signed-out. The resolution rule is a pure
  function with a test, because reading the component is what let this through.
- **Link building for the share flow lives in `lib/share/share-href.ts`.** The
  sign-in link on a share page has to carry the token back, and building that
  string inline in a component is how it got lost.
- **`apps/web` has a Jest setup for pure logic only** — link building, redirect
  targets, session resolution. No DOM and no component rendering: these are the
  decisions that broke in a browser, and they are cheap to pin down without one.
  Traded away coverage of anything that needs rendering.
- **A shared file gets its own page; closing the viewer navigates nowhere.** It
  used to send the visitor to `/`, which for anyone signed in meant landing in
  their own data room — indistinguishable, at a glance, from the share having
  exposed everything. Nothing had leaked, and an integration test now says so
  against the database: a file link resolves to the file alone, and the same
  token is refused for the folder holding it, that folder's parent, and the
  data room root.
