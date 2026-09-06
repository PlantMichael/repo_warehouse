# Phase 1 Data Model: GitHub SSO Repo Selection

All entities live in the existing SQLite database via Prisma (`prisma/schema.prisma`). `User` and
`Account` follow Auth.js's standard Prisma adapter shape (field names/types below match what
`@auth/prisma-adapter` expects, so no custom adapter code is needed) with only the app-specific
relation to `Project` added on top.

## User (new)

Represents a GitHub identity that has signed in at least once. Not a general "site account" — the
site has no username/password, profile editing, or roles; this exists solely to identify who is
signed in and to own a persisted GitHub `Account`.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid), PK | |
| `name` | String? | GitHub display name, from OAuth profile |
| `email` | String? | GitHub primary email, if public/available (not required for sign-in) |
| `image` | String? | GitHub avatar URL |
| `githubLogin` | String | GitHub username (`login`), used for display (FR-003) |
| `createdAt` | DateTime, default now | |

Relationships: one `User` has many `Account` (Auth.js allows multiple providers per user, though
this feature only wires up GitHub); one `User` has many `Project` via `Project.importedByUserId`
(the repos they've added).

## Account (new)

Represents one OAuth provider link for a `User` — for this feature, always `provider = "github"`.
Holds the access token needed to act on the user's behalf later (FR-011, FR-011c). This table is
never exposed through any API response; it is read only by server-side code that needs to make an
authenticated GitHub API call.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid), PK | |
| `userId` | String, FK → `User.id` | |
| `provider` | String | `"github"` |
| `providerAccountId` | String | GitHub numeric user ID |
| `access_token` | String? | GitHub OAuth access token (server-side only; never serialized to a client response — satisfies FR-013) |
| `scope` | String? | Granted scope string, for diagnostics (e.g. confirming `repo` was actually granted) |

Validation / lifecycle:
- GitHub's classic OAuth App tokens do not expire on a schedule and have no refresh-token flow;
  they remain valid until the user revokes the app's access on GitHub. "Revoked" is detected
  reactively (a `401`/`403` from the GitHub API when the token is used — see FR-011c and
  FR-012), not via a stored expiry.
- On repeated sign-in, the existing `Account` row for that `(provider, providerAccountId)` pair is
  updated in place (new token overwrites the old), not duplicated.

## Project (existing entity, extended)

The existing catalog entry (`prisma/schema.prisma`'s current `Project` model) gains two nullable
fields; every existing field and behavior is unchanged.

| Field | Type | Notes |
|---|---|---|
| *(existing fields unchanged)* | | `id`, `owner`, `name`, `repoUrl`, `description`, `language`, `stars`, `defaultBranch`, `readme`, `isStatic`, `entryPath`, `createdAt` |
| `importedByUserId` | String?, FK → `User.id`, nullable | Which signed-in user added this entry. Null for entries added before this feature shipped, or (if a future clarification ever allows it) added anonymously. Used only to look up an access token for re-fetching private content — **not** exposed as "ownership" (spec Assumptions: no per-user ownership/editing/deletion rights are added by this feature). |
| `isPrivate` | Boolean, default `false` | Whether the source repo was private at import time. Drives which content-fetch path (public raw vs. authenticated Contents API) is used for preview and screenshots. |
| `screenshotPaths` | String? (JSON-encoded array of relative paths) | Cached result of PNG discovery (research.md §6). `null` means "not yet computed" (e.g., a pre-existing entry from before this feature) and triggers on-demand computation + backfill on next detail-page view (FR-016); `"[]"` means "computed, found none" (so it is not recomputed every view). |

State transitions: `screenshotPaths` moves from `null` → a JSON array exactly once per project,
either at import time (new entries) or on first detail-page view after this feature ships
(pre-existing entries); it is not otherwise updated (consistent with the existing "no update/edit
functionality" limitation documented in IMPLEMENTATION_NOTES.md — a full "re-sync metadata" action,
if ever added, would refresh this too, but that is out of scope here).

## Relationships summary

```text
User 1---* Account            (Auth.js standard: a user's linked OAuth providers)
User 1---* Project            (Project.importedByUserId: who added this catalog entry)
```

## Out of scope for this data model

- No `Session` table: session state lives in the encrypted JWT cookie, not the database (research.md §2).
- No per-project "collaborators" or visibility/ACL model: the catalog remains a single shared,
  publicly-viewable collection (spec Assumptions) — `isPrivate` describes the *source repo's*
  GitHub visibility, not any access control on the catalog entry itself.
- No screenshot metadata beyond the path (captions, ordering, alt text) — the gallery displays
  whatever PNGs are found, in the order GitHub's Contents API returns them (spec Assumptions,
  Edge Cases).
