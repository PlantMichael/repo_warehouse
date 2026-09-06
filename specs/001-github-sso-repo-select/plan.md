# Implementation Plan: GitHub SSO Repo Selection

**Branch**: `001-github-sso-repo-select` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-github-sso-repo-select/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add GitHub OAuth sign-in to Project Warehouse. Signed-in users can browse a list of their own
GitHub repositories (public and private) and add one to the existing shared catalog through the
site's existing import pipeline. Adding a repo (by URL or by profile selection) now requires
sign-in; browsing the catalog stays fully public. Catalog detail pages additionally gain a
screenshot gallery built from PNG files discovered in the repo, computed once at import time (or
lazily backfilled on first view for pre-existing entries) and served through a new, narrowly-scoped
file proxy. Private-repo content (metadata, README, static-site detection, screenshots) is fetched
using the importing user's own GitHub authorization, persisted server-side (never client-readable)
so the catalog can keep serving it to anonymous visitors after the importer's session ends.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router), Node.js 18+

**Primary Dependencies**: `next-auth` (Auth.js v5) with its GitHub provider and `@auth/prisma-adapter`; existing `@prisma/client`, `react-markdown`/`remark-gfm` (unchanged)

**Storage**: SQLite via Prisma (existing) — extended with Auth.js's standard `User`/`Account` tables (to persist GitHub identity and access token server-side) and two new nullable columns on `Project` (`importedByUserId`, `screenshotPaths`)

**Testing**: Vitest (existing `src/lib/*.test.ts` pattern) for new pure logic (PNG-path filtering, any new path/URL helpers); GitHub API integration and the OAuth flow itself verified manually in the browser, consistent with this project's existing documented testing boundary (see IMPLEMENTATION_NOTES.md "Known limitations")

**Target Platform**: Web (existing local dev / single-instance deployment target — unchanged)

**Project Type**: Web application — single Next.js app serving both frontend and API routes (existing structure, unchanged)

**Performance Goals**: No new goals beyond the existing app's — OAuth round trip and repo-list fetch should feel instant on a normal connection (see spec SC-001, SC-002); no concurrency/throughput targets (single-tenant demo scale, per constitution Principle V)

**Constraints**: GitHub classic OAuth Apps expose no scope narrower than `repo` for private-repository read access (there is no read-only private-repo scope in the classic OAuth scope model) — this is an accepted, documented trade-off against FR-004's "minimum scope" requirement, not an oversight (see research.md)

**Scale/Scope**: Unchanged single-tenant catalog scale; this feature adds an auth layer and ~3 new/modified API routes, not a multi-tenant rework

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. No Server-Side Execution of Linked Code | **PASS** | No new execution surface. Screenshots are served as static image bytes through a narrowly-scoped proxy (paths pre-enumerated at import time, never arbitrary); the sandboxed-iframe preview model is untouched. |
| II. Honest Capability Scoping | **PASS** | No change to runnable/not-runnable labeling or its UI messaging. |
| III. Pure, Testable Core Logic | **PASS** | New PNG-path filtering/validation logic lands in `src/lib/` with Vitest coverage, following the existing pattern; OAuth callback wiring stays in Auth.js configuration + thin route handlers. |
| IV. Typed, User-Facing Error Handling | **PASS** | OAuth failures and private-repo-access failures get distinct messages per FR-012, extending the existing `GitHubError` pattern rather than introducing a second error convention. |
| V. Minimal, Zero-Config Operations (YAGNI) | **AMENDED (see Complexity Tracking)** | This feature deliberately adds an authentication layer, which Principle V's current text names as something the project defaults away from. The spec (user-approved) requires GitHub SSO, so this is a scoped, justified exception — SQLite/Prisma stays the only persistence layer (no new external service), and no speculative multi-tenancy is added beyond what FR-009/FR-010/FR-011 require. **Recommend running `/speckit-constitution` after this feature to formally amend Principle V's "no authentication layer" clause**, since the constitution's own governance section requires principle changes to go through an explicit amendment, not silent drift. |

No gate failures block proceeding; the one Principle V deviation is pre-justified by the
user-approved spec and recorded in Complexity Tracking below, per the constitution's own
instruction that a plan requiring a deviation "MUST document why in that plan's own
complexity-justification section rather than silently deviating."

## Project Structure

### Documentation (this feature)

```text
specs/001-github-sso-repo-select/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── auth.md
│   ├── github-repos.md
│   └── screenshots.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This is the existing single Next.js app (frontend + API routes together) — no new top-level
project or package is introduced. New/changed files layer onto the existing structure:

```text
prisma/
└── schema.prisma                          # extend: User, Account (Auth.js standard shape),
                                            #   Project.importedByUserId, Project.screenshotPaths

src/
├── auth.ts                                # NEW: Auth.js config (GitHub provider, Prisma adapter,
│                                           #   JWT session strategy, scope = read:user + repo)
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts    # NEW: Auth.js route handler (signin/callback/session)
│   │   ├── github/
│   │   │   └── repos/route.ts             # NEW: GET — list the signed-in user's own repos
│   │   ├── projects/
│   │   │   ├── route.ts                   # MODIFIED: POST now requires a session; uses the
│   │   │   │                              #   signed-in user's token when the target repo is
│   │   │   │                              #   private; computes screenshotPaths at import time
│   │   │   └── [id]/
│   │   │       ├── route.ts               # unchanged (GET one, DELETE)
│   │   │       └── screenshots/[...path]/route.ts   # NEW: serves one pre-enumerated PNG's bytes
│   │   └── preview/[id]/[[...path]]/route.ts        # MODIFIED: private-repo previews use the
│   │                                                 #   importer's stored token instead of the
│   │                                                 #   public raw-content path
│   └── layout.tsx                         # MODIFIED: session provider wrapper, sign-in/out UI
├── components/
│   ├── AuthButton.tsx                     # NEW: "Sign in with GitHub" / avatar+sign-out
│   ├── RepoPicker.tsx                     # NEW: the "select from my repos" list/search/pick UI
│   ├── ScreenshotGallery.tsx              # NEW: renders a project's screenshot gallery
│   └── AddProjectModal.tsx                # MODIFIED: gains a "pick from my repos" tab alongside
│                                           #   the existing paste-a-URL tab; gated on sign-in
└── lib/
    ├── github.ts                          # MODIFIED: metadata/README/static-check/raw-file
    │                                       #   functions accept an optional per-request access
    │                                       #   token (falls back to app-level GITHUB_TOKEN);
    │                                       #   NEW: listUserRepos(token, opts)
    ├── github-content.ts                  # NEW: fetchAuthenticatedFile() for private repos via
    │                                       #   the Contents API (raw.githubusercontent.com does
    │                                       #   not serve private content the way public raw does)
    ├── screenshots.ts                     # NEW: pure PNG-path discovery/filtering helpers
    │                                       #   (Vitest-covered, same pattern as preview.ts)
    └── prisma.ts                          # unchanged
```

**Structure Decision**: Single-project structure (unchanged) — this feature extends the existing
Next.js app in place rather than introducing a new service, package, or client/server split. All
new server logic is either a pure helper in `src/lib/` (per constitution Principle III) or a thin
API route/Auth.js config that delegates to those helpers.

## Complexity Tracking

> Constitution Check flagged one deviation: Principle V ("no authentication layer") is superseded
> by this feature's user-approved spec.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Adding an authentication layer (Auth.js + GitHub OAuth, `User`/`Account` tables) | The spec (FR-001, FR-002, FR-009) requires visitors to sign in with GitHub before adding a repo, and requires listing/reading a specific user's own repositories (FR-005, FR-011) — neither is achievable without an authenticated identity. | A no-auth design (the app's current state) cannot distinguish "this visitor" from any other, so it cannot show "your repos" or gate the add action per-user; there is no simpler way to satisfy the spec's core requirement. |
| Persisting the importing user's OAuth access token server-side (`Account` table), rather than keeping sessions fully stateless/JWT-only | FR-011c requires the catalog to keep serving a private repo's content to anonymous visitors after the importing user's own session ends — that's only possible if *some* durable, server-side credential exists to re-fetch that content on demand. | A stateless-JWT-only session (token never leaves the importing user's own encrypted cookie) would make private-repo content vanish for every other visitor the moment the importer's session/cookie expires, which contradicts FR-010 (catalog stays public) and FR-011c (graceful "no longer accessible," not a silent gap) for the normal case where the importer is simply not currently browsing. |
| Requesting the `repo` OAuth scope (full read/write to public+private repos) rather than a narrower read-only scope | FR-011 requires private-repo selection and content access; GitHub's classic OAuth Apps have no scope narrower than `repo` that includes private-repo read access — `public_repo` only covers public repos. | A GitHub App (rather than an OAuth App) can request fine-grained, read-only, per-repository permissions, but that requires a separate installation flow (an app "installation" step distinct from OAuth authorization) and app-management infrastructure disproportionate to this feature's scope; documented here as a known, accepted trade-off rather than silently requesting broader access than intended. |

## Post-Design Constitution Check

*Re-evaluated after Phase 1 (data-model.md, contracts/, quickstart.md).*

| Principle | Status | Notes |
|---|---|---|
| I. No Server-Side Execution of Linked Code | **PASS** | Confirmed by design: `contracts/screenshots.md`'s route only ever returns raw bytes for a pre-enumerated, cached path — never executes, evals, or builds anything from repo content. Private-repo fetching (research.md §5) is a read-only, authenticated HTTP GET, same execution posture as the existing public-repo fetch. |
| II. Honest Capability Scoping | **PASS** | No change to how "runnable" is determined or labeled; data-model.md's `isStatic`/`entryPath` fields are untouched. |
| III. Pure, Testable Core Logic | **PASS** | `src/lib/screenshots.ts` (PNG-path filtering) is specified as a pure helper with Vitest coverage, matching `src/lib/preview.ts`'s existing pattern; route handlers in the contracts stay thin (auth check → delegate → shape response). |
| IV. Typed, User-Facing Error Handling | **PASS** | `contracts/auth.md` and `contracts/github-repos.md` specify distinct messages for denied/cancelled OAuth, revoked authorization, and GitHub API rate-limit/network failures, extending (not replacing) the existing `GitHubError` convention. |
| V. Minimal, Zero-Config Operations (YAGNI) | **AMENDED (unchanged from pre-design)** | Data model adds only two tables (`User`, `Account`, both Auth.js's standard shape) and two nullable `Project` columns — no new external service, no speculative fields beyond what FR-011/FR-011c/FR-014 require. The Principle V amendment recommendation from the pre-design check stands. |

No new violations introduced by the detailed design. Proceeding to `/speckit-tasks`.
