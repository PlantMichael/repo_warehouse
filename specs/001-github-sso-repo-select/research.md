# Phase 0 Research: GitHub SSO Repo Selection

## 1. OAuth / SSO library

**Decision**: Use Auth.js (`next-auth` v5) with its built-in GitHub provider.

**Rationale**: Auth.js is the standard, actively-maintained solution for authentication in Next.js
App Router apps. Hand-rolling an OAuth authorization-code flow (state/CSRF handling, cookie
signing/encryption, token exchange) is exactly the kind of security-sensitive plumbing that is
easy to get subtly wrong (see FR-013's requirement that tokens never be client-readable — Auth.js's
default cookie handling satisfies this out of the box). It also ships a GitHub provider that
handles the provider-specific authorization/token-exchange endpoints and profile mapping.

**Alternatives considered**:
- Hand-rolled OAuth (raw `fetch` calls to GitHub's `/login/oauth/authorize` and
  `/login/oauth/access_token`) — rejected: reimplements security-critical, well-trodden logic for
  no benefit at this project's scope, and increases the chance of an FR-013 violation (e.g.
  accidentally exposing a token to the client).
- A hosted identity platform (Auth0, Clerk, Supabase Auth) — rejected: introduces an external
  service/account dependency this project doesn't otherwise have, in tension with constitution
  Principle V's "no external DB service" zero-config default; Auth.js keeps everything in the
  existing Next.js + SQLite/Prisma stack.

## 2. Session strategy and token persistence

**Decision**: Use Auth.js with the Prisma adapter (`@auth/prisma-adapter`) so `User` and `Account`
records — including the GitHub OAuth access token — are persisted in the existing SQLite database,
while keeping the session cookie itself as an encrypted JWT (Auth.js supports adapter-backed
account persistence together with JWT sessions; the adapter is not required to imply database
sessions).

**Rationale**: FR-011c requires that a catalog entry sourced from a private repo keeps working (or
fails gracefully) for visitors browsing *after* the importing user's own session has ended — since
the catalog is a shared, publicly-browsable collection (FR-010), the server needs a durable way to
re-fetch that private content on someone else's behalf. That requires the access token to outlive
the importing user's session, which a purely stateless JWT-only session (token embedded only in the
importer's own cookie) cannot provide. Persisting `Account.access_token` server-side (in Prisma/
SQLite, never returned in any API response — satisfying FR-013) is the minimal way to make that
work without a separate token-storage service.

**Alternatives considered**:
- Fully stateless JWT sessions, token never persisted server-side — rejected: cannot satisfy
  FR-011c/FR-010 together (see Complexity Tracking in plan.md for the full argument).
- A dedicated secrets-management service for tokens — rejected: disproportionate infrastructure for
  a single-tenant demo-scale app (constitution Principle V).

## 3. OAuth scope for private-repo access

**Decision**: Request `read:user` (basic profile) and `repo` (GitHub's classic OAuth scope that
covers read access to private repository contents).

**Rationale**: The user explicitly chose "public and private repos" for the profile-selection flow
(spec FR-011). GitHub's classic OAuth App scope model has no scope narrower than `repo` that
includes private-repository read access — `public_repo` is public-only, and there is no
`private_repo:read`-style scope. `repo` therefore is the *minimum* scope that satisfies the
requirement, even though it is broader (nominal read/write) than the feature actually uses.

**Alternatives considered**:
- `public_repo` only — rejected: does not grant access to private repos at all, failing FR-011 as
  clarified.
- A GitHub App with fine-grained, read-only "Contents" repository permission (installed per-user or
  per-org) — narrower and more correct in principle, but requires a distinct "install this GitHub
  App" flow separate from OAuth sign-in, plus app-management infrastructure (webhook handling for
  installation/permission changes, a GitHub App private key, installation-token exchange). Rejected
  as disproportionate to this feature's scope; documented as a known trade-off (also captured in
  plan.md's Complexity Tracking and spec.md's FR-004 note) and a natural candidate for a future
  iteration if the app ever needs finer-grained permissions.

## 4. Listing a user's own repositories

**Decision**: Call GitHub's `GET /user/repos` REST endpoint with the signed-in user's access token,
`affiliation=owner` (per spec Assumptions: owner's repos only, not org repos merely accessible to
them), `visibility=all` (public + private), paginated.

**Rationale**: This is GitHub's documented, standard endpoint for "list repositories for the
authenticated user," and directly supports filtering to owned repos and including private ones in
one call.

**Alternatives considered**: GitHub's GraphQL API (`viewer.repositories`) — capable of the same
result with fewer round-trips for large accounts, but the existing codebase's GitHub integration
(`src/lib/github.ts`) is entirely REST-based; introducing GraphQL alongside it for one endpoint
would add a second API style for no proportionate benefit at this scale.

## 5. Fetching private repo content (metadata already covered by REST; file bytes for preview/screenshots)

**Decision**: For private repos, fetch file contents via the REST Contents API
(`GET /repos/{owner}/{repo}/contents/{path}`) with the stored access token in the `Authorization`
header, base64-decoding the response — the same pattern the app already uses for READMEs
(`fetchReadme` in `src/lib/github.ts`), rather than `raw.githubusercontent.com`.

**Rationale**: `raw.githubusercontent.com` (used today for public-repo preview files via
`fetchRawFile`) does not reliably serve private-repo content via an `Authorization` header the way
the Contents API does; the Contents API is GitHub's documented, supported path for authenticated
file access. Public repos keep using the existing, unauthenticated `raw.githubusercontent.com` path
(cheaper, already proven, no rate-limit-relevant API call).

**Alternatives considered**: Using a signed/temporary raw-content token GitHub sometimes exposes for
private blobs — rejected: undocumented/inconsistent behavior, not a stable API contract to build on.

## 6. Discovering PNG files for the screenshot gallery

**Decision**: At import time (and lazily, on first detail-page view, for pre-existing entries added
before this feature), enumerate the repository's root directory via the Contents API
(`GET /repos/{owner}/{repo}/contents/`), filter entries to files ending in `.png`, and cache the
resulting list of paths on `Project.screenshotPaths`.

**Rationale**: Matches the existing, already-established pattern for `isStatic`/`entryPath`
(computed once at import time via `checkStaticEntry`, then read from the cached column on every
subsequent view) — consistent with constitution Principle V's "no speculative infrastructure":
avoids a live GitHub API call (and its rate-limit exposure) on every detail-page view. A root-only
scan keeps the search bounded and cheap (one API call) rather than an unbounded recursive tree
walk; per spec Assumptions, exact search depth is explicitly left as an implementation choice, and
root-only is the simplest option that satisfies the acceptance scenarios (a repo's screenshots are
conventionally at its root, alongside its README, in this app's own repo as precedent — see
`openedproject.png`/`projects.png`).

**Alternatives considered**: A full recursive scan via the Git Trees API
(`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`) — considered for catching PNGs in
subdirectories (e.g. `docs/`, `screenshots/`), but rejected for v1 as unbounded in size/cost for
large repos without a clear stopping rule; root-only is documented as a scope boundary (spec
Assumptions) rather than an oversight, and can be revisited if real usage shows most screenshots
live in a subdirectory.

## 7. Serving screenshot bytes to the browser

**Decision**: A new route, `GET /api/projects/[id]/screenshots/[...path]`, that only serves a path
if it appears in that project's cached `screenshotPaths` (reusing `isPathSafe`/`mimeFor` from
`src/lib/preview.ts`), fetching bytes via the public raw path or the authenticated Contents-API path
depending on `Project.isPrivate` (or lack of `importedByUserId`).

**Rationale**: Reuses the existing preview proxy's safety helpers (path-traversal guard, explicit
MIME typing) without reusing the preview *route* itself, because that route is gated on
`project.isStatic` (a "runnable" repo) — screenshots must work for *any* cataloged repo, static or
not (spec FR-016). Restricting valid paths to the pre-enumerated `screenshotPaths` list (rather than
accepting an arbitrary path like the general preview proxy does) is an additional, deliberate
narrowing: this route has no reason to serve anything other than the specific PNGs already
discovered for that project.

**Alternatives considered**: Extending the existing preview route to drop its `isStatic` gate for
image requests — rejected: conflates two different safety postures (the general preview proxy
intentionally serves arbitrary repo-relative paths for any file a static site's HTML might
reference; the screenshot route should not need that flexibility) and would require the general
proxy to special-case non-static projects, increasing risk of an accidental regression to
Principle I's boundary rather than reducing it.
