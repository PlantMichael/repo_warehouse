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
- **Prisma + SQLite** — a single-file, zero-config database. No external service to provision for
  a take-home; the schema (`prisma/schema.prisma`) is small enough that swapping SQLite for
  Postgres later would just mean changing `provider` and `DATABASE_URL`.
- **Tailwind CSS v4** for styling; **react-markdown + remark-gfm** for rendering READMEs.
- **Vitest** for a small unit test suite on the pure logic (URL parsing, MIME mapping, the
  `<base>`-tag injection, path-traversal guarding) — the parts worth pinning down with tests.

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

- **No authentication.** This is a single-tenant catalog — anyone with the URL can add or delete
  entries. Fine for a demo; would need real auth (and per-user ownership of catalog entries) for
  anything multi-user.
- **No caching layer for GitHub responses.** Metadata is fetched once at import time, but preview
  file requests hit `raw.githubusercontent.com` on every load. Simpler to reason about; means the
  preview is a little slower than a cached version would be, and unauthenticated GitHub API calls
  for *new* imports are rate-limited to 60/hour (documented in the README, with a `GITHUB_TOKEN`
  escape hatch that raises it to 5,000/hour).
- **SQLite over Postgres.** Chose zero-setup over "production-shaped" — right call for a
  time-boxed local demo, wrong call if this needed concurrent writers or a real deployment target.

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

## What I'd improve with more time

- A background job to periodically re-sync stale metadata (stars, description) for cataloged repos.
- Broaden static-site detection (check `public/index.html`, common GitHub Pages layouts).
- Cache proxied preview files briefly server-side to cut down on repeated GitHub requests for a
  popular preview.
- Integration tests for the API routes against a real (test) SQLite database, and a mocked GitHub
  API, rather than unit tests on the pure helpers alone.
- Basic rate-limiting/abuse protection on the import endpoint itself, independent of GitHub's own
  limits.

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
