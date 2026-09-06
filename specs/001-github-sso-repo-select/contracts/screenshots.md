# Contract: Screenshot gallery

## `GET /api/projects/[id]/screenshots/[...path]`

Serves the raw bytes of one PNG file that was already discovered for this project's gallery
(FR-014, FR-015, FR-016). This is intentionally **not** a general file proxy — see research.md §7
for why it's a separate route from the existing preview proxy.

**Auth**: None required — the gallery is part of the publicly-browsable catalog (FR-010), same as
the rest of a project's detail page.

**Path parameters**:

| Param | Notes |
|---|---|
| `id` | Project ID |
| `path` | Must exactly match one entry in that project's cached `screenshotPaths` (data-model.md). Any other path — including a syntactically valid PNG path that just wasn't in the cached list, or a path-traversal attempt — is rejected. |

**Response `200`**: the PNG's raw bytes, `Content-Type: image/png`, cacheable
(`Cache-Control: public, max-age=60`, matching the existing preview proxy's caching for non-HTML
files).

**Response `404`**:
- Project doesn't exist, or
- `path` is not in that project's `screenshotPaths` (covers both "never existed" and "not yet
  computed" — see below), or
- The underlying fetch to GitHub for that path fails (e.g., file was deleted from the repo since
  import) — the cached path becomes stale; not proactively cleaned up (spec Assumptions: no
  update/edit functionality), but a `404` here is a safe, honest failure mode.

**Response `403`**: the source repo is private and content fetch fails because the importer's
stored access has been revoked (FR-011c) — this is what makes the detail page show the
"no longer accessible" message from that edge case, rather than a broken `<img>`.

## Screenshot list computation trigger (not a separate endpoint)

`screenshotPaths` (data-model.md) is computed:
1. At import time, inside the existing `POST /api/projects` flow (see `github-repos.md`), for
   newly-added projects.
2. Lazily, the first time `GET /api/projects/[id]` (the existing detail-page data load) is called
   for a project where `screenshotPaths` is still `null` — satisfying FR-016's "must work for
   existing catalog entries" without a separate migration/backfill script. The computed result is
   written back to that row so it is not recomputed on subsequent views.

This trigger point is a plan-level detail (not a new public contract) — documented here so
`/speckit-tasks` places the "compute and cache screenshotPaths" logic in both call sites correctly.
