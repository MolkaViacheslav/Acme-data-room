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
