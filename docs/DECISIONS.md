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
