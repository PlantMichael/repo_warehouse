<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles: V. Minimal, Zero-Config Operations (YAGNI) — removed the blanket "no
  authentication layer" clause (backward-incompatible redefinition); authentication is now
  permitted when a specific, approved feature spec requires it, scoped to what that spec states
  (no general per-user ownership/editing/roles, catalog stays a shared public collection)
- Added sections: none (Security Requirements gained two bullets: secrets list now includes
  OAuth-related env vars; a new bullet requiring server-side-only access tokens)
- Removed sections: none
- Rationale: the GitHub SSO Repo Selection feature (specs/001-github-sso-repo-select/) shipped a
  spec-approved authentication layer (GitHub OAuth sign-in, gating who may add a catalog entry and
  listing a signed-in user's own repos); plan.md's Constitution Check flagged this as a documented
  Principle V deviation and recommended this amendment so the exception is ratified rather than
  left as silent drift
- Templates requiring updates: none checked automatically by this command; downstream
  speckit-plan/speckit-tasks/speckit-checklist runs should re-read this file at execution time
- Follow-up TODOs: none
-->

# Project Warehouse Constitution

## Core Principles

### I. No Server-Side Execution of Linked Code (NON-NEGOTIABLE)
The server MUST NEVER execute, `eval`, `require`, shell out to, or otherwise run code originating
from a linked repository. The only execution surface for third-party code is a client-side
`<iframe sandbox="allow-scripts">` that explicitly omits `allow-same-origin`, so previewed content
runs with an opaque origin and cannot read this app's cookies, storage, or DOM, and cannot
navigate the parent page. Repo files reach the browser only via read-only proxying from GitHub's
raw content API — never fetched to disk and executed, never passed through a build step on the
server.
**Rationale**: The original brief ("upload a repo and run it on the site") is a remote-code-
execution vulnerability if implemented naively. This principle is the load-bearing safety boundary
that lets the app keep the spirit of that brief without that risk.

### II. Honest Capability Scoping
A repository MUST be labeled "runnable" only when it is a plain static site (a root `index.html`,
no required build step). Every other repository (frameworks, compiled languages, anything needing
a server or build step) MUST be cataloged with its metadata and README and MUST NOT be presented
as runnable — the UI MUST show a clear, specific explanation of why it isn't. The system MUST NOT
imply a capability (execution, building, running) that it does not actually provide.
**Rationale**: Overstating what the tool can safely do erodes trust and re-opens the RCE risk
principle I exists to close; understating it defeats the point of the catalog. Honesty about the
boundary is itself a feature.

### III. Pure, Testable Core Logic
Logic with no inherent dependency on a request/response lifecycle — URL parsing and validation,
MIME-type mapping, `<base>`-tag injection, path-traversal guarding, and similar — MUST be
implemented as pure functions in `src/lib/`, decoupled from Next.js route handlers, and MUST have
Vitest unit coverage. Route handlers MUST stay thin: parse input, delegate to `src/lib/`, shape the
response.
**Rationale**: Pure functions are cheap to test without mocking a server or hitting the live GitHub
API, and cheap tests are the ones that actually get maintained (see README's "Tests" section and
IMPLEMENTATION_NOTES.md for why GitHub API integration itself is intentionally not unit-tested).

### IV. Typed, User-Facing Error Handling
External failure modes — invalid GitHub URLs, nonexistent repos, GitHub API rate limits, network
errors — MUST surface as distinct typed errors (e.g. `GitHubError` with a discriminated reason),
not generic thrown exceptions or swallowed failures. Each distinct failure MUST map to a specific,
user-facing message shown inline in the UI (e.g. the add-repo form), not a generic "something went
wrong."
**Rationale**: Users hitting the 60/hour unauthenticated GitHub rate limit, a typo'd URL, or a
private repo need to know which of those happened to fix it themselves; a single generic error
forces them to guess.

### V. Minimal, Zero-Config Operations (YAGNI)
The project MUST default to the simplest infrastructure that satisfies its actual scope: SQLite via
Prisma for persistence (no external DB service), no speculative multi-tenancy, and idempotent
imports (`repoUrl` unique constraint returns the existing entry rather than erroring or
duplicating). An authentication layer is permitted only to the extent an approved feature spec
requires it (e.g. gating who may add a catalog entry, or identifying "your" GitHub repos) — it MUST
NOT grow into general per-user ownership, editing rights, or roles beyond what that spec states,
and the catalog itself MUST remain a single shared, publicly-browsable collection unless a future
amendment says otherwise. New dependencies or infrastructure MUST be justified against this scope
before being added, not added for hypothetical future needs.
**Rationale**: This is a scoped assessment project, not a product with known future requirements;
every piece of infrastructure or abstraction beyond the current, real requirement is unjustified
cost. Authentication was originally excluded outright, but the GitHub SSO Repo Selection feature
(see `specs/001-github-sso-repo-select/`) established a real, spec-approved need for identity (to
gate adding a repo and to list a signed-in user's own GitHub repos) — the principle now scopes
*what* authentication may be used for rather than forbidding it, so future features don't have to
silently re-justify the same deviation or, worse, drift into unscoped multi-tenancy without an
amendment.

## Security Requirements

- The preview proxy (`src/app/api/preview/[id]/[[...path]]/route.ts`) MUST guard against path
  traversal on every requested file path before touching the filesystem or upstream fetch.
- The preview iframe's `sandbox` attribute MUST NOT include `allow-same-origin` while it includes
  `allow-scripts`; if a future feature requires relaxing this, it MUST be treated as a breaking
  change to Principle I and go through the amendment procedure below, not a routine code change.
- No secrets (e.g. `GITHUB_TOKEN`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET`) MUST be committed; `.env`
  stays gitignored and `.env.example` MUST document required variables with placeholder
  (non-functional) values only.
- Where authentication exists (per Principle V), any OAuth/session access token MUST stay
  server-side only — never serialized into a client-visible API response (e.g. a session-lookup
  endpoint) or embedded in a client-readable cookie value.
- All GitHub content fetched for preview or cataloging MUST be treated as untrusted: rendered
  README content goes through `react-markdown` (no raw HTML execution), and proxied files are
  served with explicit MIME types rather than inferred/executed content types.

## Development Workflow

- `npm test` (Vitest) MUST pass before a change to `src/lib/` is considered complete; new pure
  logic added there MUST ship with corresponding unit tests in the same change.
- `npm run lint` MUST be clean (or intentional exceptions documented) before a change is considered
  complete.
- User-facing behavior changes (new error cases, new capability-scoping rules, schema changes)
  MUST be reflected in `README.md` and, where they affect implementation rationale, in
  `IMPLEMENTATION_NOTES.md`.
- Schema changes MUST go through a Prisma migration (`npx prisma migrate dev`) committed to the
  repo, not hand-edited against a running database.

## Governance

This constitution supersedes ad hoc practice for this repository. Amendments require:
1. A documented rationale for the change (what problem it solves or what it clarifies).
2. An explicit version bump per semantic versioning: MAJOR for backward-incompatible principle
   removal/redefinition (e.g. relaxing Principle I's sandboxing), MINOR for a new principle or
   materially expanded guidance, PATCH for wording/clarification with no rule change.
3. Updating the Sync Impact Report at the top of this file and the version/date line below in the
   same change.

All feature specs, plans, and task lists produced by the Spec Kit workflow for this project MUST
be consistent with these principles; a plan that requires violating Principle I or II MUST document
why in that plan's own complexity-justification section rather than silently deviating here.

**Version**: 2.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
