# Contract: Browsing and adding from your own repos

## `GET /api/github/repos`

Lists the signed-in user's own GitHub repositories (FR-005, FR-006, FR-011).

**Auth**: Requires a signed-in session. `401` if not signed in.

**Query parameters**:

| Param | Type | Notes |
|---|---|---|
| `q` | string, optional | Client-side-equivalent name filter (FR-006); server applies a simple case-insensitive substring match on repo name |
| `page` | integer, optional, default `1` | Pass-through pagination (FR-005's "page or scroll") |

**Response `200`**:

```jsonc
{
  "repos": [
    {
      "name": "my-static-site",
      "fullName": "adalovelace/my-static-site",
      "description": "A tiny demo site",
      "updatedAt": "2026-08-30T12:00:00Z",
      "isPrivate": false,
      "url": "https://github.com/adalovelace/my-static-site"
    }
  ],
  "hasMore": false
}
```

- Empty `repos` array (with `hasMore: false`) for a user with zero repos — the UI renders the
  empty-state message from User Story 2, acceptance scenario 3, rather than treating `[]` as an
  error.

**Response `401`** (not signed in):

```jsonc
{ "error": "Sign in with GitHub to see your repositories." }
```

**Response `502`/`429`** (GitHub API failure or rate limit while listing — FR-012):

```jsonc
{ "error": "GitHub API rate limit exceeded while listing your repositories. Try again later." }
```

**Response `401` with a re-auth hint** (stored token rejected by GitHub — revoked/expired):

```jsonc
{ "error": "Your GitHub authorization appears to have been revoked. Please sign in again.", "reauth": true }
```

## Adding a selected repo: reuses `POST /api/projects`

No new endpoint for "add the repo I picked" — the "select from my repos" UI takes the chosen
repo's `url` (from the response above) and submits it to the **existing** `POST /api/projects`
endpoint, unchanged in its request/response shape (FR-008: reuse existing cataloging behavior).
What changes on that existing endpoint for this feature:

| Change | Reason |
|---|---|
| Requires a signed-in session; `401` if signed out, for **both** the URL-paste path and the profile-pick path | FR-009 |
| If the target repo is private, uses the signed-in user's stored access token (data-model.md `Account.access_token`) instead of the app-level `GITHUB_TOKEN` for the metadata/README/static-check fetches | FR-011 |
| Persists `importedByUserId` (the signed-in user) and `isPrivate` on the created `Project` row | data-model.md |
| Computes `screenshotPaths` at import time (research.md §6) in addition to the existing `isStatic`/`entryPath` detection | FR-014 |
| A private repo the signed-in user does *not* actually own/have access to (e.g., a crafted request) MUST fail with a `404`-style "not found" message, exactly as an inaccessible repo does today — it MUST NOT leak whether the repo exists privately for someone else | Security: no repo-existence oracle for repos the requester can't see |

All other existing behavior (duplicate-import returns the existing entry, typed `GitHubError`
messages for not-found, etc.) is unchanged.
