# Project Warehouse

Link a GitHub repository and catalog it in a searchable warehouse. If the repo is a static site (a
plain HTML/CSS/JS site with a root `index.html`, no build step), it runs live in the browser via a
sandboxed preview. Everything else is cataloged with its README and metadata. Sign in with GitHub
to add a repo — either by pasting its URL or by picking one straight from your own GitHub account
(public or private) — and browsing repos with screenshots gets a gallery on their detail page.

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
- **Auth.js (`next-auth` v5) + `@auth/prisma-adapter`** — GitHub OAuth sign-in, JWT sessions, with
  the GitHub access token persisted server-side (never sent to the client)
- **Tailwind CSS v4** for styling, `react-markdown` + `remark-gfm` for rendering READMEs
- **GitHub REST API** (`api.github.com` for metadata/README/your-repos listing/private-repo
  contents, `raw.githubusercontent.com` for proxied public static-site files and screenshots)

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

Browsing the catalog needs no sign-in. **Adding a repository requires signing in with GitHub** —
see "GitHub sign-in" below to set that up locally.

### GitHub sign-in

1. Register an OAuth App at [github.com/settings/developers](https://github.com/settings/developers)
   with authorization callback URL `http://localhost:3000/api/auth/callback/github`.
2. Copy `.env.example` to `.env` (already present) and fill in:

   ```
   GITHUB_CLIENT_ID=your_oauth_app_client_id
   GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
   AUTH_SECRET=some_long_random_string   # e.g. `openssl rand -base64 32`
   ```
3. Click "Sign in with GitHub" in the header. Once signed in, the "+" add-repo modal gains a
   "My repos" tab listing your own public and private repositories, alongside the existing
   paste-a-URL option.

These are separate from the existing `GITHUB_TOKEN` (below), which is unrelated to sign-in and
only raises the unauthenticated API rate limit.

### Tests

```bash
npm test
```

Runs the Vitest unit suite (`src/lib/*.test.ts`) covering GitHub URL parsing, MIME mapping, the
preview `<base>`-tag rewriting, path-traversal guarding, and screenshot-path filtering/validation -
the pure logic, not the GitHub API integration or the OAuth flow itself (see
[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for why).

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

- `src/auth.ts` — Auth.js configuration: GitHub OAuth provider (`read:user repo` scope),
  `@auth/prisma-adapter` (persists `User`/`Account`, including the access token, in SQLite), JWT
  session strategy. Also exports `getGitHubAccessToken(userId)` for server-side code that needs to
  act on a signed-in user's behalf.
- `src/lib/github.ts` — parses/validates GitHub URLs, fetches repo metadata/README/root-directory
  listing, checks for a root `index.html`, and lists a signed-in user's own repos
  (`listUserRepos`) — all with typed errors (`GitHubError`) for 404s, rate limits, and revoked
  authorization. Every fetch takes an optional per-request access token (falls back to the
  app-level `GITHUB_TOKEN`).
- `src/lib/github-content.ts` — fetches one file's bytes from a private repo via the authenticated
  Contents API (`raw.githubusercontent.com` doesn't serve private content).
- `src/lib/screenshots.ts` — pure helpers for the screenshot gallery: filtering a directory listing
  to root-level `.png` files, and validating a requested path against a project's cached list.
- `src/app/api/auth/[...nextauth]/route.ts` — mounts Auth.js's handler (sign-in/callback/sign-out).
- `src/app/api/github/repos/route.ts` — lists the signed-in user's own repos (`401` if signed out).
- `src/app/api/projects/route.ts` — `GET` (list + search), `POST` (import a repo: requires
  sign-in, validates the URL, fetches from GitHub using the signed-in user's token, persists via
  Prisma including `isPrivate`/`importedByUserId`/`screenshotPaths`, returns the existing entry if
  already imported).
- `src/app/api/projects/[id]/route.ts` — `GET` one project (lazily backfills `screenshotPaths` if
  never computed), `DELETE` to remove a catalog entry.
- `src/app/api/projects/[id]/screenshots/[...path]/route.ts` — serves one screenshot's bytes;
  only ever serves a path already in that project's cached `screenshotPaths` list.
- `src/app/api/preview/[id]/[[...path]]/route.ts` — the sandboxed-preview proxy. Fetches a file
  from the repo's raw GitHub content (or, for a private repo, via the authenticated Contents API
  using the importer's stored token), and for the HTML entry point injects a `<base>` tag (via
  `src/lib/preview.ts`) so relative asset URLs (`./style.css`, `./script.js`, ...) resolve back
  through this same proxy route instead of against the app's own origin.
- `src/lib/preview.ts` — pure helpers used by the preview route (MIME-type mapping, `<base>`-tag
  injection, path-traversal guarding), split out so they're unit-testable without a request context.
- `prisma/schema.prisma` — `Project` (extended with `importedByUserId`/`isPrivate`/
  `screenshotPaths`), plus Auth.js's standard `User`/`Account` models.
- `src/app/page.tsx` / `src/components/Explorer.tsx` — the catalog grid, search, and the "+"
  modal for adding a repo.
- `src/components/AddProjectModal.tsx` — "Paste URL" and "My repos" tabs; gated on sign-in.
- `src/components/RepoPicker.tsx` — lists/filters/paginates the signed-in user's own repos.
- `src/components/AuthButton.tsx` / `SignInErrorBanner.tsx` — sign-in/out control and a banner for
  a denied/failed OAuth attempt.
- `src/app/projects/[id]/page.tsx` — the detail page: name / stack info / description on the
  left, live preview (or an explanation of why there isn't one) on the right, screenshot gallery
  (if any PNGs were found) and README below.
- `src/components/ScreenshotGallery.tsx` — thumbnail grid that enlarges an image on click.

## Error handling

- Invalid GitHub URLs, nonexistent repos, GitHub API rate limits, and revoked GitHub authorization
  each return a distinct, user-facing message from the API and are shown inline in the add-repo
  form or repo picker.
- Re-submitting a repo that's already in the warehouse returns the existing entry instead of
  erroring or duplicating it (`repoUrl` is a unique constraint in the schema).
- A cancelled/denied GitHub sign-in shows a clear banner instead of a blank page.
- Path traversal (`..`) is rejected in the preview proxy and the screenshot route; the screenshot
  route additionally only ever serves a path already in that project's cached allow-list.
- A private repo's content becoming unreachable (importer's authorization revoked) surfaces as a
  distinct "no longer accessible" response, not a broken preview or image.
- Custom `not-found.tsx` and `error.tsx` pages for missing projects and unexpected errors.

## Known limitations

- Static-site detection only checks for `index.html` at the repository root (not in `public/`,
  `dist/`, etc.) — a deliberate, documented scope boundary rather than an oversight.
- Screenshot discovery only scans a repo's root directory for `.png` files, not subdirectories.
- GitHub's classic OAuth Apps have no scope narrower than `repo` for private-repo read access, so
  sign-in requests `repo` (nominal read/write) even though this app only ever reads — see
  `specs/001-github-sso-repo-select/research.md` §3 for the full tradeoff analysis.
- Sign-in exists to gate *adding* a repo and to list your own repos; there's still no per-user
  ownership, editing, or roles beyond that — the catalog itself remains a single shared,
  publicly-browsable collection.
- GitHub's unauthenticated rate limit (60/hour) applies to importing new repos unless
  `GITHUB_TOKEN` is set; it does not affect browsing already-imported projects or previews.
