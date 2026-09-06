# Quickstart: Validating GitHub SSO Repo Selection

## Prerequisites

1. A GitHub OAuth App registered at <https://github.com/settings/developers>:
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github` (for local dev)
   - Note the generated **Client ID** and **Client Secret**.
2. Environment variables added to `.env` (extending the existing file):

   ```bash
   GITHUB_CLIENT_ID=your_oauth_app_client_id
   GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
   AUTH_SECRET=$(openssl rand -base64 32)   # or any long random string; used to sign/encrypt session cookies
   ```

   These are distinct from the existing `GITHUB_TOKEN` (which stays as the optional app-level
   token for unauthenticated/public catalog imports and is unrelated to sign-in).
3. A Prisma migration applied for the schema changes in [data-model.md](./data-model.md):

   ```bash
   npx prisma migrate dev
   ```

4. `npm install` (picks up `next-auth` and `@auth/prisma-adapter` once added to `package.json`).
5. `npm run dev`, then open <http://localhost:3000>.

## Scenario 1 — Sign in with GitHub (User Story 1)

1. On the homepage, click **Sign in with GitHub**.
2. Approve the authorization prompt on GitHub.
3. **Expected**: redirected back to the site, now showing your GitHub username and avatar.
4. Click **Sign out**.
5. **Expected**: back to the signed-out state.

Negative path: start step 1 again, but click **Cancel** on GitHub's prompt instead of approving.
**Expected**: back on the site, still signed out, with a visible message that sign-in wasn't
completed (not a blank page or a crash).

## Scenario 2 — Browse and select from your own repos (User Story 2)

1. Signed in from Scenario 1, open the "select from my repos" flow (e.g., a tab in the existing
   "+" add-project modal).
2. **Expected**: a list of your GitHub repositories (name, description, updated date), including
   at least one private repo if your GitHub account has one.
3. Type part of a repo name into the filter box.
4. **Expected**: the list narrows to matching names.

If your GitHub account has zero repositories, **Expected**: a clear empty-state message instead of
a blank list.

## Scenario 3 — Add the selected repo to the catalog (User Story 3)

1. From the list in Scenario 2, pick one of your repositories (try a private one, to exercise
   FR-011) and confirm adding it.
2. **Expected**: it appears in the catalog grid; opening its detail page shows the same
   metadata/README/preview-or-explanation as any repo added by URL.
3. Repeat step 1 for the *same* repository.
4. **Expected**: no duplicate is created; you're taken to the existing catalog entry.
5. Sign out, then browse to that project's detail page directly.
6. **Expected**: it's still fully visible (catalog stays public per FR-010) — including its
   README/metadata and, if it was a private repo, its preview still resolves (content is served via
   the stored access token, not your live session).

## Scenario 4 — Screenshot gallery (User Story 4)

1. Add (or open) a catalog entry for a repository that has one or more `.png` files at its root
   (this repo itself — `mmcnish929`'s Project Warehouse — has `openedproject.png` and
   `projects.png`, good test material if it's ever added to its own catalog instance).
2. **Expected**: its detail page shows a screenshot gallery with those images, viewable at a
   readable size (not squeezed thumbnails only).
3. Open the detail page of a catalog entry whose repo has **no** PNG files.
4. **Expected**: page renders normally, no gallery section, no broken-image icons.
5. For a catalog entry that already existed before this feature (created against the pre-migration
   schema, so `screenshotPaths` is `null`): open its detail page.
6. **Expected**: the gallery computes and appears (or the "no gallery" state renders cleanly) on
   this first view — confirming the lazy-backfill path from FR-016 works, not just newly-added
   entries.

## Scenario 5 — Sign-in required to add, not to browse (FR-009, FR-010)

1. While signed out, browse the catalog and open a few project detail pages.
2. **Expected**: everything renders normally, no sign-in prompt.
3. While signed out, try the existing "paste a URL" add flow.
4. **Expected**: prompted to sign in with GitHub before the add proceeds (rather than the import
   silently failing or succeeding anonymously).

## Automated checks

```bash
npm test    # Vitest — new pure-logic coverage for PNG-path discovery/filtering (src/lib/screenshots.ts)
npm run lint
```

GitHub API integration and the OAuth flow itself are validated manually via the scenarios above,
consistent with this project's existing testing boundary (see IMPLEMENTATION_NOTES.md).
