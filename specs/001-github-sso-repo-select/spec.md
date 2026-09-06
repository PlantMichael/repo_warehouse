# Feature Specification: GitHub SSO Repo Selection

**Feature Branch**: `001-github-sso-repo-select`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Implement Github sso. After logging into github, you should be able to select a repo from your profile to display on this website."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with GitHub (Priority: P1)

A visitor signs in to the site using their GitHub account instead of an anonymous session, so the site knows who they are before they add anything to the catalog.

**Why this priority**: Every other capability in this feature (browsing your own repos, adding one to the catalog) depends on having an authenticated GitHub identity first. Without this, nothing else can work.

**Independent Test**: Can be fully tested by clicking "Sign in with GitHub" from a signed-out state, completing GitHub's authorization prompt, and landing back on the site in a signed-in state showing the user's GitHub username/avatar.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on the site, **When** they click "Sign in with GitHub", **Then** they are redirected to GitHub's authorization page.
2. **Given** a visitor who approves the GitHub authorization prompt, **When** GitHub redirects back to the site, **Then** the visitor is signed in and the site displays their GitHub username and avatar.
3. **Given** a visitor who declines or cancels the GitHub authorization prompt, **When** GitHub redirects back to the site, **Then** the visitor remains signed out and sees a clear message that sign-in was not completed.
4. **Given** a signed-in user, **When** they choose to sign out, **Then** their session ends and they return to the signed-out state.

---

### User Story 2 - Browse and select from your own repos (Priority: P2)

A signed-in user browses a list of repositories from their own GitHub profile and picks one to add to the catalog, instead of having to know and paste its URL.

**Why this priority**: This is the main convenience the feature adds on top of sign-in — it replaces manual URL entry with a guided pick-from-your-own-repos flow. It only makes sense once User Story 1 exists, so it is next.

**Independent Test**: Can be fully tested by signing in, opening the "select from my repos" flow, seeing a list of the signed-in user's GitHub repositories, and choosing one.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the "select from my repos" flow, **Then** they see a list of repositories owned by their GitHub account (name, description, and updated date for each).
2. **Given** a signed-in user whose GitHub account has more repositories than fit on one screen, **When** they browse the list, **Then** they can page or scroll through all of their repositories.
3. **Given** a signed-in user with zero repositories on GitHub, **When** they open the "select from my repos" flow, **Then** they see a clear empty-state message instead of a blank or broken list.
4. **Given** the list of a signed-in user's repositories, **When** they type into a filter/search box, **Then** the list narrows to matching repository names.

---

### User Story 3 - Add the selected repo to the catalog (Priority: P3)

After picking a repository from their profile, the user adds it to the same catalog the site already shows, using the site's existing import/cataloging behavior (metadata fetch, static-site detection, README rendering).

**Why this priority**: This closes the loop — selection is only useful if it results in the repo actually appearing in the catalog like any other project. It depends on Story 2 (something to select) and reuses the site's existing add-a-project behavior, so it is scoped last.

**Independent Test**: Can be fully tested by selecting a repo from the "my repos" list and confirming it appears in the catalog grid with the same detail page (metadata, preview-or-explanation, README) as a repo added by pasting a URL.

**Acceptance Scenarios**:

1. **Given** a signed-in user has picked one of their repos from the list, **When** they confirm adding it, **Then** the repo appears in the catalog with its name, description, and README, the same as any repo added today by URL.
2. **Given** a repo the user picks is already in the catalog, **When** they confirm adding it, **Then** the site shows the existing catalog entry rather than creating a duplicate.
3. **Given** a repo the user picks is a plain static site (root `index.html`, no build step), **When** it is added, **Then** it is marked runnable and previewable exactly as it would be if added by URL.

---

### User Story 4 - Screenshot gallery from repo images (Priority: P4)

A visitor viewing a catalog entry's detail page sees a gallery of screenshots pulled directly from PNG image files in that repository, giving a visual sense of the project without needing to run its live preview or read its README.

**Why this priority**: This is a display enhancement independent of sign-in and repo selection — it improves how any catalog entry is presented (whether added by URL or by profile selection, before or after this feature). It has no dependency on Stories 1-3 and is the lowest priority because it's additive polish, not core functionality.

**Independent Test**: Can be fully tested by opening the detail page of a catalog entry whose repository contains one or more PNG files and confirming they render as a gallery, and by opening the detail page of a repository with no PNG files and confirming the page still renders cleanly without a gallery.

**Acceptance Scenarios**:

1. **Given** a cataloged repository that contains one or more PNG image files, **When** a visitor opens that project's detail page, **Then** they see those PNG images rendered as a screenshot gallery.
2. **Given** a cataloged repository that contains no PNG image files, **When** a visitor opens that project's detail page, **Then** the page renders normally with no gallery section and no broken image placeholders or errors.
3. **Given** a repository with multiple PNG files, **When** the gallery renders, **Then** a visitor can view each image at a readable size (e.g., via thumbnails that enlarge on selection), rather than all images being squeezed into a single small strip.

---

### Edge Cases

- What happens if the user's GitHub session/token expires or is revoked while they are mid-flow (e.g., browsing their repo list)? The site MUST detect this and prompt re-sign-in rather than showing a silent failure or stale data.
- What happens if GitHub's API is rate-limited or unreachable while fetching the signed-in user's repo list? The site MUST show a specific, user-facing message distinct from a generic error (consistent with how the catalog already handles GitHub API failures).
- What happens if a user signs out while one of their repos is already in the catalog? The catalog entry MUST remain (it belongs to the catalog, not to the session that added it).
- What happens if two different signed-in users each try to add the same repository? The second attempt MUST resolve to the existing single catalog entry (existing idempotent-import behavior), not a duplicate or an error.
- What happens if a signed-out visitor tries to paste a URL to add a repo (the site's existing add path)? They MUST be prompted to sign in with GitHub before the add can proceed, rather than the add silently failing or succeeding anonymously.
- What happens if a catalog entry was added from a private repository and the contributing user's access to that repo is later revoked or the repo is deleted/made inaccessible? The entry MUST show a clear "no longer accessible" message on its preview/detail rather than stale or broken content, and MUST NOT be silently removed from the catalog.
- What happens if a repository contains a very large number of PNG files, or very large PNG files? The gallery MUST remain usable (e.g., via lazy loading or thumbnailing) rather than making the detail page slow or unresponsive.
- What happens if a repository's PNG files are actually unrelated to the project (e.g., icons, logos, or generated build assets rather than screenshots)? The site is not expected to distinguish intent — it displays what it finds; this is a known, accepted limitation rather than a defect.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST offer a "Sign in with GitHub" action that starts GitHub's standard OAuth authorization flow.
- **FR-002**: The site MUST establish a signed-in session for the user only after GitHub confirms successful authorization, and MUST leave the user in a signed-out state if authorization is denied, cancelled, or fails.
- **FR-003**: The site MUST display the signed-in user's GitHub username and avatar while they are signed in, and MUST offer a visible way to sign out.
- **FR-004**: The site MUST request only the minimum GitHub permission scope needed to list the signed-in user's repositories and read their metadata/README/files for cataloging — it MUST NOT request permissions unrelated to that purpose.
- **FR-005**: Once signed in, the user MUST be able to view a list of repositories associated with their own GitHub account, showing at least each repository's name, description, and last-updated date.
- **FR-006**: The user MUST be able to filter/search their own repository list by name.
- **FR-007**: The user MUST be able to select exactly one repository from that list and add it to the site's catalog.
- **FR-008**: Adding a repository selected from the user's profile MUST reuse the site's existing cataloging behavior: metadata/README fetch, static-site ("runnable") detection, and the existing duplicate-import handling (an already-catalogued repo resolves to its existing entry).
- **FR-009**: Adding a repository to the catalog — whether by pasting a URL or by selecting from a signed-in user's own profile — MUST require the visitor to be signed in with GitHub. A signed-out visitor attempting to add a repo (by either path) MUST be prompted to sign in first.
- **FR-010**: The catalog of previously-added repositories MUST remain visible to all visitors regardless of sign-in status — browsing the catalog, opening a project's detail page, and viewing its preview MUST NOT require sign-in. Sign-in is required only to add a new repository.
- **FR-011**: The "select from my repos" flow MUST list both public and private repositories owned by the signed-in user. Cataloging or previewing a private repository MUST fetch its content (metadata, README, files) using the signed-in user's own authorized access, not the site's unauthenticated/public access path.
- **FR-011a**: The site MUST request an OAuth scope sufficient to read the signed-in user's private repositories (in addition to listing and reading public ones), since FR-011 requires private-repo selection.
- **FR-011b**: The sandboxed preview behavior (iframe sandboxing, static-site-only "runnable" detection, no server-side execution of repo code) MUST apply identically to catalog entries sourced from private repositories — only the method of fetching the underlying content differs (authenticated vs. public), not the safety model.
- **FR-011c**: If a catalog entry sourced from a private repository can no longer be accessed (e.g., the contributing user's authorization is revoked, or the repo's visibility/permissions change), the site MUST show a clear message on that entry's preview/detail rather than a silent failure or stale content; the catalog entry itself MUST NOT be silently deleted.
- **FR-012**: The site MUST surface distinct, user-facing error messages for GitHub OAuth failures (denied/cancelled authorization, expired/revoked session) and for GitHub API failures while listing the user's repos or fetching a private repo's content (rate limit, network error, lost access), consistent with how existing add-by-URL errors are surfaced.
- **FR-013**: The site MUST NOT store the user's GitHub OAuth token or credentials anywhere client-readable (e.g., not in local storage or a non-HTTP-only cookie).
- **FR-014**: The site MUST discover PNG image files present in a cataloged repository and render them as a screenshot gallery on that project's detail page, using the same read-only, no-server-execution content-fetching path already used for README/preview content (public fetch for public repos, the contributing user's authorized access for private repos).
- **FR-015**: A repository with no PNG files MUST render its detail page without a gallery section and without broken-image errors.
- **FR-016**: The screenshot gallery MUST apply to catalog entries regardless of how they were added (by URL, or by profile selection) and regardless of whether the feature that added them predates this capability — i.e., it MUST work for existing catalog entries, not only newly-added ones.

### Key Entities

- **User Session**: Represents a signed-in visitor's authenticated identity for the duration of their session — GitHub username, avatar URL, and enough authorization to call GitHub's API on their behalf. Not persisted beyond what's needed to maintain the session.
- **Repository (existing entity, reused)**: The site's existing catalog entry for a linked GitHub repository (name, description, README, runnable/static-site status). This feature adds a new way to arrive at "add this repository" — selecting from a signed-in user's own profile — but does not change what a catalog entry is once created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can go from clicking "Sign in with GitHub" to seeing their own repository list on the site in under 15 seconds under normal network conditions.
- **SC-002**: A signed-in user can find and add one of their own repositories to the catalog in 3 or fewer interactions after their repo list loads (e.g., search/scroll, select, confirm).
- **SC-003**: 100% of GitHub OAuth failures (denied, cancelled, expired) and repo-list-fetch failures (rate limit, network error) result in a specific, human-readable message rather than a blank state or a generic error.
- **SC-004**: A repository added via profile selection is indistinguishable in the catalog from one added via URL — same metadata completeness and same runnable/static-site detection accuracy.
- **SC-005**: 100% of catalog entries for repositories containing at least one PNG file show a screenshot gallery on their detail page; 100% of entries for repositories with none show no gallery and no broken-image indicators.

## Assumptions

- GitHub OAuth (GitHub's standard "OAuth App" / "Sign in with GitHub" flow) is the SSO mechanism; no other identity provider is in scope.
- Sessions are ordinary web sessions (e.g., a session cookie) scoped to this site; no cross-app single-sign-on beyond GitHub itself is required.
- The "select from my repos" list surfaces repositories where the signed-in user is the owner; organization-owned repositories the user merely has access to are out of scope unless later clarified otherwise.
- Repository preview behavior (sandboxed iframe, static-site-only "runnable" detection, no server-side execution) is unchanged by this feature and applies identically regardless of whether a repo is public or private, or added by URL or by profile selection; only the underlying content-fetch method (public vs. authenticated) differs.
- This feature does not add per-user ownership, editing rights, or deletion rights over catalog entries; the catalog itself remains a single shared collection, viewable by anyone, that any signed-in user can contribute to.
- Adding a repository (by URL or by profile selection) now requires GitHub sign-in; browsing the catalog does not. This is a deliberate, scoped expansion of the site's current no-auth design, not a full multi-tenant rework.
- Adding a project by uploading files/folders from a visitor's local machine (rather than linking a GitHub repository) is explicitly **out of scope** for this feature. It would reintroduce the "run arbitrary uploaded code" risk the constitution's Principle I deliberately scoped away from; all catalog entries continue to originate from a GitHub repository (by URL or by profile selection).
- The PNG screenshot gallery searches the repository for PNG files (e.g., at the root, or a reasonably bounded/shallow search) rather than performing an exhaustive recursive scan of every directory; exact search depth is an implementation detail for the planning phase, not a behavioral requirement.
- The gallery displays whatever PNGs are found without attempting to distinguish "screenshots" from other PNG assets (icons, logos, diagrams) — see Edge Cases.
