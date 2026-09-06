# Project Warehouse

Link a public GitHub repository and catalog it in a searchable warehouse. If the repo is a static
site (a plain HTML/CSS/JS site with a root `index.html`, no build step), it runs live in the
browser via a sandboxed preview. Everything else is cataloged with its README and metadata.

## Why it works this way

The original brief for this project was "upload a repo and run it on the site." Actually executing
arbitrary uploaded/linked code on a server is a different (and much larger) problem than a 4-hour
assessment allows to solve safely — it requires real sandboxing (containers, resource limits,
network isolation), and a naive version (e.g. shelling out to run uploaded code) is a textbook
remote-code-execution vulnerability. This app keeps the spirit of the idea — link a GitHub repo,
browse it, "run" it on the site — but scopes "run" to something both safe and honest:

- The server never executes any code from a linked repo.
- A repo is only treated as "runnable" if it has a root `index.html`. Its files are proxied
  read-only from GitHub and rendered inside an `<iframe sandbox="allow-scripts">`. Scripts execute
  (so simple JS demos work), but because the sandbox omits `allow-same-origin`, the iframe content
  is given a unique opaque origin — it cannot read this app's cookies, storage, or DOM, and cannot
  navigate the parent page.
- Anything that needs a build step or a server (React apps, APIs, compiled languages, etc.) is
  cataloged with its metadata and README, but explicitly not run, with a message explaining why.

## Stack

- **Next.js 16** (App Router, TypeScript) — one app for both frontend and backend (API routes)
- **Prisma + SQLite** — zero-config local persistence, no external DB service to stand up
- **Tailwind CSS v4** for styling, `react-markdown` + `remark-gfm` for rendering READMEs
- **GitHub REST API** (`api.github.com` for metadata/README, `raw.githubusercontent.com` for
  proxied static-site files)

## Setup

Requires Node.js 18+.

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm install` also runs `prisma generate` automatically (via a `postinstall` script).
`npx prisma migrate dev` creates the local SQLite database at `prisma/dev.db` (gitignored) from
the schema in `prisma/schema.prisma`. There's no seed step - the catalog starts empty; add a repo
from the UI (e.g. `https://github.com/mdn/beginner-html-site-styled` is a good static-site demo).

No authentication and no demo credentials - the app is a single-tenant catalog with no login.

### Tests

```bash
npm test
```

Runs the Vitest unit suite (`src/lib/*.test.ts`) covering GitHub URL parsing, MIME mapping, the
preview `<base>`-tag rewriting, and path-traversal guarding - the pure logic, not the GitHub API
integration itself (see [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for why).

### Optional: raise the GitHub API rate limit

Unauthenticated requests to the GitHub API are limited to 60/hour, which is easy to hit while
testing. Copy `.env.example` to `.env` (already present with an empty token) and set:

```
GITHUB_TOKEN=ghp_your_token_here
```

A token with no scopes (public repo read access only) is sufficient — create one at
[github.com/settings/tokens](https://github.com/settings/tokens). This raises the limit to
5,000/hour. Fetching raw file contents for the static-site preview does not use the rate-limited
API at all, so previews work regardless.

## How it's built

- `src/lib/github.ts` — parses/validates GitHub URLs, fetches repo metadata, README, and checks
  for a root `index.html`, all with typed errors (`GitHubError`) for 404s and rate limits.
- `src/app/api/projects/route.ts` — `GET` (list + search), `POST` (import a repo: validates the
  URL, fetches from GitHub, persists via Prisma, returns the existing entry if already imported).
- `src/app/api/projects/[id]/route.ts` — `GET` one project, `DELETE` to remove a catalog entry.
- `src/app/api/preview/[id]/[[...path]]/route.ts` — the sandboxed-preview proxy. Fetches a file
  from the repo's raw GitHub content, and for the HTML entry point injects a `<base>` tag (via
  `src/lib/preview.ts`) so relative asset URLs (`./style.css`, `./script.js`, ...) resolve back
  through this same proxy route instead of against the app's own origin.
- `src/lib/preview.ts` — pure helpers used by the preview route (MIME-type mapping, `<base>`-tag
  injection, path-traversal guarding), split out so they're unit-testable without a request context.
- `prisma/schema.prisma` — a single `Project` model; see the file for fields.
- `src/app/page.tsx` / `src/components/Explorer.tsx` — the catalog grid, search, and the "+"
  modal for adding a repo.
- `src/app/projects/[id]/page.tsx` — the detail page: name / stack info / description on the
  left, live preview (or an explanation of why there isn't one) on the right, README below.

## Error handling

- Invalid GitHub URLs, nonexistent repos, and GitHub API rate limits each return a distinct,
  user-facing message from the API and are shown inline in the add-repo form.
- Re-submitting a repo that's already in the warehouse returns the existing entry instead of
  erroring or duplicating it (`repoUrl` is a unique constraint in the schema).
- Path traversal (`..`) is rejected in the preview proxy route.
- Custom `not-found.tsx` and `error.tsx` pages for missing projects and unexpected errors.

## Known limitations

- Static-site detection only checks for `index.html` at the repository root (not in `public/`,
  `dist/`, etc.) — a deliberate, documented scope boundary rather than an oversight.
- No authentication — this is a single-tenant demo catalog, not a multi-user product.
- GitHub's unauthenticated rate limit (60/hour) applies to importing new repos unless
  `GITHUB_TOKEN` is set; it does not affect browsing already-imported projects or previews.
