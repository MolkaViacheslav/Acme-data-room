# Execution Plan

Work top to bottom. Tick boxes as you go. Do not start a phase until the
previous one builds and runs.

Time estimates are for a focused developer. The client's "6-8 hours" is
optimistic for the full scope; ~14-16 hours is realistic for Phases 0-8.

---

## Phase 0 — Skeleton + deploy pipeline (~1.5h)

Deploy an empty app **first**. Deployment problems discovered on the last day
kill take-homes. This phase is non-negotiable.

- [x] pnpm workspace monorepo: `apps/web`, `apps/api`
- [x] `apps/api`: NestJS init, `/health` endpoint returning `{ ok: true }`
- [x] `apps/web`: Next.js App Router + Tailwind + shadcn/ui init
- [x] Supabase project created; Postgres connection strings noted
      (pooled `:6543` for runtime, direct `:5432` for migrations)
- [ ] Supabase Storage: private bucket `data-room-files` created
- [x] `.env.example` in both apps listing every variable, no secrets
- [ ] Deploy `apps/api` to Railway; `/health` reachable over public HTTPS
- [ ] Deploy `apps/web` to Vercel; it calls `/health` and renders the result
- [x] CORS on the API: explicit origin allowlist, `credentials: true`

**Cross-site cookie gotcha.** The frontend (`*.vercel.app`) and backend
(`*.railway.app`) are different sites, so the auth cookie must be
`SameSite=None; Secure; HttpOnly`. Verify in Phase 2 that login survives a page
refresh in Safari as well as Chrome. If Safari blocks it, fall back to a Bearer
token held in memory plus a refresh endpoint — and note the tradeoff in
`docs/DECISIONS.md`.

---

## Phase 1 — Data model (~1.5h)

Write `apps/api/prisma/schema.prisma`. Target shape:

```
User          id, email (unique), passwordHash, name, createdAt
DataRoom      id, name, ownerId -> User, rootFolderId, createdAt, updatedAt
Folder        id, name, dataRoomId, parentId? -> Folder, path, createdAt, updatedAt
File          id, name, folderId -> Folder, dataRoomId, storageKey, mimeType,
              sizeBytes, uploadStatus, createdAt, updatedAt
Share         id, resourceType (DATA_ROOM|FOLDER|FILE), resourceId, dataRoomId,
              mode (PUBLIC_LINK|RESTRICTED), token? (unique), role (VIEWER),
              createdById, expiresAt?, revokedAt?, createdAt
ShareRecipient id, shareId, email, userId?  @@unique([shareId, email])
```

Three modelling decisions that carry the whole project — implement them
deliberately:

1. **Every DataRoom owns a root Folder row.** So `File.folderId` is never null
   and `@@unique([folderId, name])` actually enforces name uniqueness at the
   drive root too. (Postgres treats NULLs as distinct, so a nullable `folderId`
   would silently allow duplicates.) Same for `@@unique([parentId, name])` on
   Folder.
2. **`Folder.path` is a materialized path** — a string like
   `/<rootId>/<childId>/<grandchildId>/`. Recomputed on move. Indexed. This
   makes "everything under this folder" a single indexed prefix query instead
   of N round trips, and it is the answer to two of the three README scaling
   questions.
3. **`Share.role` is an enum with `VIEWER` today.** Adding `EDITOR` later is one
   enum value plus policy code — no schema migration of the sharing model.

- [ ] Schema written with the above constraints and enums
- [ ] Indexes: `Folder(dataRoomId, path)`, `File(folderId, name)`,
      `File(folderId, createdAt, id)`, `Share(token)`, `Share(dataRoomId)`
- [ ] `onDelete: Cascade` set so deleting a DataRoom cleans up cleanly
- [ ] Migration applied against Supabase
- [ ] Seed script: one user, one data room with a small nested tree

---

## Phase 2 — Auth (~2h)

- [ ] `POST /auth/register` — email, password (min 8), name. bcrypt hash.
- [ ] `POST /auth/login` — sets `access_token` httpOnly cookie
- [ ] `POST /auth/logout` — clears cookie
- [ ] `GET /auth/me` — current user or 401
- [ ] `JwtAuthGuard` global; `@Public()` decorator to opt out
- [ ] On register: auto-create the user's DataRoom + its root Folder in one
      transaction
- [ ] Frontend: `/login`, `/register` pages with inline field validation
- [ ] Frontend: middleware redirecting unauthenticated users to `/login`
- [ ] Verified: refresh the deployed frontend, session persists

---

## Phase 3 — AccessService (~1h)

Do this **before** the CRUD endpoints. Every later endpoint calls into it.

One method: `resolveAccess(actor, resourceType, resourceId) -> { role: OWNER |
VIEWER | NONE }`. Resolution order:

1. Is the actor the owner of the resource's DataRoom? → `OWNER`
2. Is there a live (not revoked, not expired) Share whose resource *is* this
   resource, or is an **ancestor** of it? Ancestry is a prefix check against
   `Folder.path`, so this is one query, not a loop.
   - `mode = PUBLIC_LINK` → the caller must present a valid token
   - `mode = RESTRICTED` → the actor must be a `ShareRecipient` (match on
     `userId`, or on `email` for users who registered after being invited)
3. Otherwise `NONE` → throw `NotFoundException`

- [ ] Implemented with unit tests covering: owner, direct share, inherited
      share via ancestor folder, revoked share, expired share, wrong token,
      stranger

---

## Phase 4 — Folders & files API (~2h)

Folders:
- [ ] `POST /folders` — `{ name, parentId }`; computes `path`; 409 on duplicate name
- [ ] `GET /folders/:id` — metadata + breadcrumb chain (derived from `path`)
- [ ] `GET /folders/:id/children` — subfolders + files, cursor-paginated,
      sortable by name / size / updatedAt
- [ ] `PATCH /folders/:id` — rename; 409 on conflict
- [ ] `GET /folders/:id/delete-preview` — `{ folderCount, fileCount, totalBytes }`
      from a single prefix-aggregate query. Powers the delete warning dialog.
- [ ] `DELETE /folders/:id` — deletes subtree in one transaction, then removes
      the storage objects. Storage cleanup failure must not roll back the DB —
      log it and move on.

Files:
- [ ] `PATCH /files/:id` — rename; 409 on conflict, with a suggested
      `"report (2).pdf"` name in the error payload
- [ ] `PATCH /files/:id/move` — `{ folderId }`; 409 on name conflict in target
- [ ] `DELETE /files/:id` — DB row, then storage object
- [ ] `GET /files/:id/download-url` — short-TTL signed URL, access-checked

---

## Phase 5 — Upload (~2h)

Direct browser → Supabase Storage. The file never passes through Railway.

- [ ] `POST /files/upload-url` — `{ folderId, name, mimeType, sizeBytes }`.
      Validates access, resolves the name conflict, enforces limits
      (PDF only, max 50 MB), creates a `File` row with `uploadStatus: PENDING`
      and a `storageKey` of `<dataRoomId>/<fileId>.pdf`, returns a signed
      upload URL.
- [ ] `POST /files/:id/complete` — verifies the object exists in storage and
      flips `uploadStatus` to `READY`. Files stuck in `PENDING` are never listed.
- [ ] Frontend upload queue: drag-and-drop zone + file picker, multiple files,
      per-file progress bar, per-file cancel, per-file retry on failure
- [ ] Progress requires `XMLHttpRequest` (`upload.onprogress`) — `fetch` cannot
      report upload progress. Verify the exact Supabase signed-upload request
      contract in current docs before wiring this.
- [ ] Rejected files (wrong type, too large) show inline in the queue with the
      reason; they do not block the others

---

## Phase 6 — Explorer UI (~3h)

- [ ] `/d/[folderId]` route rendering the folder contents
- [ ] Breadcrumb bar, clickable, truncating in the middle when deep
- [ ] Table view: name, type icon, size, modified. Sortable headers.
- [ ] Row actions menu: open, rename, move, share, delete
- [ ] Rename: inline edit, optimistic, reverts with a toast on 409
- [ ] Move: dialog with a folder tree picker; prevent moving a folder into its
      own descendant
- [ ] Delete: dialog showing the real counts from `delete-preview`
- [ ] PDF viewer: dialog or `/f/[fileId]` page rendering the signed URL in an
      `<iframe>`; handles the expired-URL case by re-requesting
- [ ] Empty state, loading skeleton, and error state for the folder view
- [ ] Keyboard: `Esc` closes dialogs, `Enter` confirms

---

## Phase 7 — Sharing (~2.5h)

- [ ] `POST /shares` — `{ resourceType, resourceId, mode, recipientEmails?, expiresAt? }`
- [ ] `GET /shares?resourceId=` — list live shares on a resource
- [ ] `DELETE /shares/:id` — sets `revokedAt`; revocation is immediate
- [ ] Public read routes accepting `?token=` and going through `AccessService`
- [ ] Share dialog: mode toggle, copy-link button with a copied confirmation,
      recipient email chips, list of existing shares with revoke buttons
- [ ] `/share/[token]` page: read-only explorer. No upload zone, no row action
      menu, no rename affordances — the read-only view must not show controls
      that would 403.
- [ ] Edge cases, each with a real UI state:
      - link revoked while the recipient is viewing → next action shows
        "Access to this item has been revoked" and offers a link home
      - shared folder deleted by the owner while being viewed → same treatment
      - expired link → its own message, distinct from revoked
      - invited-by-email user who is not logged in → prompted to sign in, then
        returned to the shared resource

---

## Phase 8 — README, ERD, deploy check (~1.5h)

- [ ] `docs/ERD.md` — Mermaid ER diagram
- [ ] `docs/AI_USAGE.md` finalized
- [ ] README: overview, live URLs, local setup (exact commands, env vars),
      architecture, design decisions from `docs/DECISIONS.md`, ERD, AI note
- [ ] README "How it scales" — answer all three questions concretely:
  - **Subtree size and item count.** Today: one aggregate query over the
    materialized path prefix (`WHERE path LIKE '/root/a/%'`), backed by the
    `(dataRoomId, path)` index. At scale: denormalized `descendantCount` /
    `descendantBytes` counters on Folder, updated in the same transaction as
    mutations, or asynchronously via an outbox — because a prefix scan over a
    hot 100k-row drive gets expensive and the numbers tolerate slight staleness.
  - **100,000 files.** Cursor (keyset) pagination on `(folderId, name, id)`,
    never `OFFSET` — offset degrades linearly. Server-side sort and search, with
    a `pg_trgm` GIN index on `name` for substring search. Virtualized rows on the
    client. Subtree stats read from counters, not computed per render. Cover the
    listing query with a composite index so it stays index-only.
  - **Per-user roles.** `Share.role` is already an enum; adding `EDITOR` is one
    value plus write-permission checks in `AccessService`. Because every
    permission check already funnels through `resolveAccess`, the change is
    localized. Conflicting grants resolve as most-specific-wins, then
    highest-role-wins.
- [ ] Final pass on the deployed apps: register a fresh account, upload, share,
      open the link in a private window, revoke, confirm the recipient loses access
- [ ] Seeded demo account credentials in the README so reviewers can log in fast

---

## Phase 9 — Polish, only if time remains

- [ ] Folder-level drag-and-drop to move items
- [ ] Multi-select with bulk delete/move
- [ ] Search across the data room
- [ ] Recent files / activity log
- [ ] E2E happy-path test (Playwright)
- [ ] Google OAuth alongside email/password

---

## Open questions

_(Claude Code: append here instead of expanding scope silently.)_
