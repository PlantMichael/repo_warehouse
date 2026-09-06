# Implementation Notes

## What I built

**Project Warehouse** — a catalog for public GitHub repositories. You link a repo by URL; the app
fetches its metadata and README from the GitHub API and stores it. If the repo has a root
`index.html` (a plain static HTML/CSS/JS site, no build step), it's marked "runnable" and gets a
live preview rendered in a sandboxed iframe, proxied read-only from the repo's files on GitHub.
Everything else is cataloged with metadata and README only.

You can add a repo, browse/search the catalog, view a repo's detail page, and remove a repo from
the catalog. See [README.md](README.md) for the full feature/architecture rundown and setup steps.

## The scope decision

The original prompt for this idea was "upload a repo and run it on the website." I deliberately
narrowed that: safely executing arbitrary uploaded/linked code server-side is a sandboxing problem
(containers, resource limits, network isolation) that doesn't fit in a 4-hour assessment, and a
naive version (shelling out to run uploaded code) is a remote-code-execution vulnerability, not an
engineering shortcut. Instead, "run" is scoped to static sites only, executed client-side in a
sandboxed iframe with no server-side code execution at all — a smaller feature, but a real and
safe one, rather than a larger one that either doesn't work or isn't safe to ship.

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend and backend (API routes) in one app, which
  kept the project small enough to actually finish: no separate client/server repos, no CORS setup,
  one dev server.
- **Prisma + Postgres** — originally SQLite (a single-file, zero-config database, no external
  service to provision for a take-home); switched to a hosted Postgres instance after deploying to
  Vercel exposed that SQLite doesn't survive a serverless environment's ephemeral filesystem (see
  "Moving off SQLite for Vercel" below). The schema was small enough that the switch was just
  changing `provider` in `prisma/schema.prisma` and regenerating the migration.
- **Tailwind CSS v4** for styling; **react-markdown + remark-gfm** for rendering READMEs.
- **Vitest** for a small unit test suite on the pure logic (URL parsing, MIME mapping, the
  `<base>`-tag injection, path-traversal guarding) — the parts worth pinning down with tests.

## GitHub SSO repo selection (added after the initial build)

A later feature added GitHub sign-in, letting a signed-in user browse and add from their own
GitHub repos (public and private), and added a screenshot gallery to detail pages. Full design
record: `specs/001-github-sso-repo-select/` (spec, research, data model, contracts, tasks).

- **Auth.js (`next-auth` v5) over hand-rolled OAuth or a hosted identity platform.** Hand-rolling
  the authorization-code flow re-implements security-critical plumbing (state/CSRF, cookie
  signing) for no benefit at this scope; a hosted platform (Auth0, Clerk) adds an external service
  dependency this project doesn't otherwise have. Auth.js keeps everything in the existing
  Next.js + Prisma stack.
- **The GitHub access token is persisted server-side (`Account.access_token` via
  `@auth/prisma-adapter`), not just held in the session JWT.** The catalog is a shared, publicly
  browsable collection - a private repo's preview/README/screenshots must keep working for
  *other* visitors after the importing user's own session ends. A stateless-JWT-only session
  can't provide that, since the token would vanish with the importer's cookie. The token is never
  serialized into any API response (`GET /api/auth/session` excludes it by Auth.js's own default
  session shape, which this app's `session` callback doesn't override to add it back).
- **OAuth scope is `read:user repo`, not a narrower "public-repo-only" scope.** GitHub's classic
  OAuth Apps have no scope between "public repos only" (`public_repo`) and "read/write everything"
  (`repo`) - there's no private-repo-*read-only* scope in that model. `repo` is therefore the
  minimum scope that satisfies "select a private repo," even though it's nominally broader
  (read/write) than this app ever exercises. A GitHub App with fine-grained read-only permissions
  would be more correct but requires a separate installation flow disproportionate to this
  feature's scope - documented as a known, accepted trade-off (see research.md §3).
  Principle V's original "no authentication layer" clause has since been amended (constitution
  v2.0.0) to formally scope this exception rather than leave it as silent drift.
- **Private-repo file bytes go through the Contents API, not `raw.githubusercontent.com`.**
  `raw.githubusercontent.com` doesn't reliably honor an `Authorization` header for private
  content; the REST Contents API (`GET /repos/{owner}/{repo}/contents/{path}` with
  `Accept: application/vnd.github.raw+json`) does, and is the same pattern already used for
  READMEs. Public repos keep using the cheaper, already-proven raw path.
- **Screenshot discovery is root-directory-only, computed once and cached.** Matches the existing
  `isStatic`/`entryPath` pattern (computed at import time, read from a cached column thereafter)
  rather than a live GitHub API call on every detail-page view. A full recursive tree walk would
  catch screenshots in subdirectories but is unbounded in cost for large repos with no natural
  stopping point - left as a documented scope boundary, not an oversight.
- **The screenshot route is new, not a relaxed version of the preview proxy.** The preview proxy
  is intentionally gated on `project.isStatic` (only "runnable" repos get a preview) and serves
  arbitrary repo-relative paths a static site's HTML might reference. Screenshots must work for
  *any* cataloged repo, static or not, and only ever needs to serve the specific paths already
  discovered - so it validates the requested path against that project's cached
  `screenshotPaths` list rather than accepting anything, a narrower and separate safety posture.
- **Adding a repo (URL-paste or profile-pick) now requires sign-in; browsing stays fully public.**
  This was a deliberate, user-confirmed scope line (not "make everything require login") - the
  catalog's core value (a publicly browsable collection) is unchanged; only the "who can add to
  it" question changes.

## Moving off SQLite for Vercel (post-deploy fix)

Deploying to Vercel surfaced two real bugs, both since fixed:

- **`src/auth.ts` never actually received GitHub OAuth credentials.** It relied on Auth.js's
  automatic env-var inference (`AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`), but this project's own
  `.env.example`/README/quickstart document `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` instead - a
  naming mismatch, so the GitHub provider had no credentials regardless of what was set. Fixed by
  passing `clientId`/`clientSecret` explicitly from `process.env` in the provider config.
- **Missing `trustHost: true`.** Auth.js rejects every `/api/auth/*` request by Host header in any
  production deployment it doesn't recognize as trusted (Vercel/Cloudflare Pages are auto-detected;
  nothing else is, by design - it's a Host-header-injection guard). Fixed by setting it explicitly,
  standard practice for a self-hosted single-instance deployment where the Host header is trusted
  by the deployer, consistent with this project's Principle V posture.

Neither of those explained the actual crash reported, though: the site was returning a bare
"An error occurred" on every page, which is this app's React error boundary catching a **Server
Components render error** (React error #441) — something thrown during server-side rendering, not
a client-side fetch failure like the two bugs above. The real cause: **no environment variables
were configured on the Vercel project at all**, including `DATABASE_URL`. Every page queries
`Project` via Prisma directly in a Server Component (the home page, the catalog list, project
detail pages), so with no working database connection, literally every page threw immediately.

Setting `DATABASE_URL` alone wouldn't have been a real fix, though, because **SQLite doesn't work
on Vercel at all** - even pointed at a valid path, a serverless function's filesystem is ephemeral
per-invocation, and `prisma/dev.db` is (correctly) gitignored, so it wouldn't even exist in the
deployed bundle. This was a real architectural gap between the original zero-config design (a
single, long-running local process, per constitution Principle V) and a serverless deployment
target, not something a config tweak could paper over.

**Fix:** switched `prisma/schema.prisma`'s datasource to `postgresql`, pointed at a hosted Postgres
instance (Prisma Postgres, in this case), and replaced the SQLite migration history with a fresh
Postgres-native one (`prisma/migrations/20260906031015_init_postgres/`) generated and applied
against the real target database - verified with a direct CRUD round-trip (create/read/delete)
against it, not just a successful migration run, plus a full type-check/lint/test/build pass and a
manual pass through the running app pointed at the same database. Local dev now requires a real
Postgres connection too (no more SQLite fallback), since Prisma's datasource provider is fixed at
schema level, not swappable per-environment via `DATABASE_URL` alone.

## Key implementation decisions

- **Static-site detection is root-`index.html`-only.** No attempt to detect or run build tooling
  (bundlers, `npm run build`, frameworks) — that would mean executing untrusted code server-side,
  which is exactly what this app is designed not to do. This is a documented scope boundary, not
  an oversight.
- **Preview sandboxing:** the iframe uses `sandbox="allow-scripts"` — scripts run (so simple JS
  demos work), but *without* `allow-same-origin` the iframe content is forced into a unique opaque
  origin. It can't read this app's cookies/localStorage/DOM, and it can't navigate the parent page,
  regardless of what the previewed repo's code tries to do.
- **The preview is a proxy, not a fetch-and-store.** `GET /api/preview/[id]/[...path]` fetches
  files live from `raw.githubusercontent.com` on each request and rewrites the entry HTML with a
  `<base href="/api/preview/{id}/">` tag so relative asset URLs (`./style.css`) resolve back
  through the same proxy. This means previews always reflect the repo's current default branch,
  at the cost of an extra round-trip to GitHub per file.
- **Duplicate imports return the existing record** instead of erroring (`repoUrl` is a unique
  constraint) — resubmitting a repo you already added is a no-op, not a failure.
- **GitHub API errors are typed** (`GitHubError` with a `status`) so the API route can return
  distinct, accurate messages for "not found" vs. "rate limited" vs. "unexpected," instead of one
  generic failure message.

## Tradeoffs

- **Sign-in gates adding, not deleting.** GitHub SSO (above) requires sign-in to add a repo, but
  `DELETE /api/projects/[id]` is unchanged — still unauthenticated, matching the app's existing
  no-per-user-ownership design (see the GitHub SSO section above: this feature deliberately didn't
  add ownership/editing rights, just identity for the add-gate and "your repos" listing). Anyone
  with a catalog entry's URL can still remove it. Fine for a demo; would need real per-entry
  ownership for anything multi-user.
- **No caching layer for GitHub responses.** Metadata is fetched once at import time, but preview
  file requests hit `raw.githubusercontent.com` on every load. Simpler to reason about; means the
  preview is a little slower than a cached version would be, and unauthenticated GitHub API calls
  for *new* imports are rate-limited to 60/hour (documented in the README, with a `GITHUB_TOKEN`
  escape hatch that raises it to 5,000/hour).
- **Postgres, not SQLite.** Originally chose SQLite for zero-setup local development; switched to
  a hosted Postgres instance once a real (serverless) deployment target was in the picture, since
  SQLite's local file doesn't survive that environment (see "Moving off SQLite for Vercel" above).
  The trade-off flipped from "zero external infra" to "one more account to provision," which is the
  right call once you actually need to deploy somewhere serverless, wrong call if this only ever
  needed to run as a single local/long-lived process.

## Known limitations

- Static-site detection only checks for `index.html` at the repo root, not `public/`, `dist/`,
  `docs/`, or GitHub Pages conventions.
- No update/edit functionality — catalog entries are added or removed, not modified in place (a
  "re-sync metadata" action would be the natural next addition).
- No pagination on the catalog list — fine at demo scale, would need it before this could hold
  hundreds of entries.
- No automated end-to-end test for the actual GitHub API integration (it's the one thing that's
  awkward to unit test without either hitting the real API or building a mocking layer); the
  request-shaping and error-typing logic around it is straightforward enough that I judged this an
  acceptable gap for the time box, and it was verified manually against real repos in the browser
  (see README's error-handling section for what was exercised).
- The OAuth sign-in flow itself (GitHub SSO feature) is likewise not automated-tested, for the same
  reason, and additionally requires a real, user-registered GitHub OAuth App to exercise at all -
  it was verified as far as possible without one (redirect wiring, session-gating on every
  affected route, the error-banner path) but a full sign-in round trip needs the project owner's
  own OAuth App credentials in `.env` (see README's "GitHub sign-in" section) to verify end-to-end.

## What I'd improve with more time

- A background job to periodically re-sync stale metadata (stars, description) for cataloged repos.
- Broaden static-site detection (check `public/index.html`, common GitHub Pages layouts).
- Cache proxied preview files briefly server-side to cut down on repeated GitHub requests for a
  popular preview.
- Integration tests for the API routes against a real (test) SQLite database, and a mocked GitHub
  API, rather than unit tests on the pure helpers alone.
- Basic rate-limiting/abuse protection on the import endpoint itself, independent of GitHub's own
  limits.
- A GitHub App (fine-grained, read-only per-repository permissions) instead of an OAuth App's
  broad `repo` scope, if the private-repo-access trade-off documented above ever needed tightening.
- Recursive (or configurable-depth) screenshot discovery, instead of root-directory-only.

## AI assistance

This project was built with **Claude Code** (Anthropic's CLI agent) end-to-end — planning the
scope, writing the application code, running the dev server and exercising the app in a browser to
verify behavior, and writing this documentation. I want to be specific about what that means in
practice, since "AI-assisted" can mean very different things:

- The initial project scaffold (`create-next-app` defaults: Next.js config, Tailwind setup,
  TypeScript config, ESLint config) is generated boilerplate, not hand- or AI-written from scratch.
- All application code — the API routes, the GitHub integration, the Prisma schema, the React
  components, the preview-sandboxing approach, the tests — was written by Claude Code under my
  direction, iterated on based on my scope decisions (notably, pushing back on the original
  "upload and run any repo" idea in favor of the safer, scoped version above) and my design
  references (I sketched the two wireframes describing the card-grid list and the two-column
  detail layout; Claude Code implemented the UI to match).
- I reviewed the resulting code, ran it, and exercised it myself before considering it done — I
  understand what each piece does and can explain the tradeoffs above because they were decisions
  I was involved in making, not just accepted output.
