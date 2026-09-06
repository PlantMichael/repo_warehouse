---

description: "Task list template for feature implementation"
---

# Tasks: GitHub SSO Repo Selection

**Input**: Design documents from `/specs/001-github-sso-repo-select/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: No test-task phases were requested for this feature. Per constitution Principle III, new pure logic in `src/lib/` still ships with Vitest coverage in the same change (see T010); OAuth/GitHub-API integration is verified manually via quickstart.md scenarios, consistent with this project's existing testing boundary (IMPLEMENTATION_NOTES.md).

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Exact file paths are included in each description

## Path Conventions

Single Next.js project (existing structure, unchanged) — `src/app/`, `src/components/`, `src/lib/`, `prisma/` at repository root. See plan.md's Project Structure section for the full file map.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new dependency and environment-variable scaffolding this feature needs.

- [X] T001 Add `next-auth` and `@auth/prisma-adapter` to `package.json` dependencies and run `npm install`
- [X] T002 [P] Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `AUTH_SECRET` (with explanatory comments, empty placeholder values) to `.env.example`, per [quickstart.md](./quickstart.md) Prerequisites

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth and content-fetching infrastructure that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extend `prisma/schema.prisma` with `User`, `Account` (Auth.js standard shape) and new `Project.importedByUserId` / `Project.isPrivate` / `Project.screenshotPaths` fields per [data-model.md](./data-model.md); run `npx prisma migrate dev` to generate and apply the migration
- [X] T004 [P] Create `src/auth.ts`: Auth.js config using the GitHub provider, `@auth/prisma-adapter`, JWT session strategy, and OAuth scope `read:user repo`, per [research.md](./research.md) §1-3 and [contracts/auth.md](./contracts/auth.md) (depends on T003)
- [X] T005 [P] Create `src/app/api/auth/[...nextauth]/route.ts` mounting the Auth.js handler exported from `src/auth.ts` (depends on T004)
- [X] T006 Wrap the app in Auth.js's `SessionProvider` in `src/app/layout.tsx` so client components can read sign-in state (depends on T004)
- [X] T007 [P] Extend `src/lib/github.ts`: add an optional `accessToken` parameter to `fetchRepoMetadata`, `fetchReadme`, and `checkStaticEntry` (used instead of the app-level `GITHUB_TOKEN` when provided), and add `listUserRepos(accessToken, { q, page })`, per [research.md](./research.md) §4 and [contracts/github-repos.md](./contracts/github-repos.md)
- [X] T008 [P] Create `src/lib/github-content.ts` with `fetchAuthenticatedFile(ref, branch, path, accessToken)` using the Contents API for private-repo file bytes, per [research.md](./research.md) §5
- [X] T009 [P] Create `src/lib/screenshots.ts`: pure helpers to filter a repo directory listing down to root-level `.png` entries and to validate a requested path against a project's cached list, per [research.md](./research.md) §6 and [contracts/screenshots.md](./contracts/screenshots.md)
- [X] T010 [P] Create `src/lib/screenshots.test.ts` with Vitest coverage for the helpers added in T009 (constitution Principle III; depends on T009)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign in with GitHub (Priority: P1) 🎯 MVP

**Goal**: A visitor can sign in with GitHub and sign out again; the site reflects their identity while signed in.

**Independent Test**: Click "Sign in with GitHub" from a signed-out state, complete GitHub's authorization prompt, and land back on the site signed in with username/avatar shown (spec.md User Story 1).

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `src/components/AuthButton.tsx`: "Sign in with GitHub" action when signed out; avatar + GitHub username + "Sign out" when signed in (FR-001, FR-003)
- [X] T012 [US1] Mount `AuthButton` in `src/app/layout.tsx`'s site header (depends on T006, T011)
- [X] T013 [US1] Add sign-in failure messaging: detect the Auth.js callback `error` query param and render a clear "sign-in wasn't completed" message instead of a blank/broken page (FR-002; [contracts/auth.md](./contracts/auth.md) Failure behavior)
- [ ] T014 [US1] Verify User Story 1 end-to-end per [quickstart.md](./quickstart.md) Scenario 1 (sign in, cancel/deny, sign out)

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Browse and select from your own repos (Priority: P2)

**Goal**: A signed-in user can see, search, and page through their own GitHub repositories (public and private).

**Independent Test**: Sign in, open the "select from my repos" flow, see the signed-in user's repos, and filter the list by name (spec.md User Story 2).

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement `GET /api/github/repos` in `src/app/api/github/repos/route.ts`: `401` if signed out, otherwise call `listUserRepos` with the session's access token, apply `q`/`page`, return typed error messages for rate-limit/network/revoked-auth failures, per [contracts/github-repos.md](./contracts/github-repos.md) (depends on T007)
- [X] T016 [P] [US2] Create `src/components/RepoPicker.tsx`: list/search UI consuming T015's response, with an empty-state message for zero repos and paging/scroll for long lists (FR-005, FR-006)
- [X] T017 [US2] Add a "select from my repos" tab to `src/components/AddProjectModal.tsx` that renders `RepoPicker`, gated on sign-in (shows `AuthButton`/a sign-in prompt if signed out) (depends on T011, T016)
- [X] T018 [US2] Surface `RepoPicker` fetch failures (rate limit, network error, revoked authorization) using the distinct messages from T015's error responses (FR-012)
- [ ] T019 [US2] Verify User Story 2 end-to-end per [quickstart.md](./quickstart.md) Scenario 2 (list, filter, empty state, private repos visible)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Add the selected repo to the catalog (Priority: P3)

**Goal**: Picking a repo from your profile (or pasting a URL) adds it to the shared catalog using the existing cataloging behavior, now gated on sign-in and private-repo-aware.

**Independent Test**: Select a repo from the "my repos" list, confirm it appears in the catalog with the same detail-page treatment as a repo added by URL, including a private repo (spec.md User Story 3).

### Implementation for User Story 3

- [X] T020 [US3] Modify `POST /api/projects` in `src/app/api/projects/route.ts` to require a session (`401` if signed out) for both the URL-paste and profile-pick submission paths (FR-009)
- [X] T021 [US3] Extend the same handler to use the signed-in user's access token (T007) for metadata/README/static-check fetches when the target repo is private, and to persist `importedByUserId` and `isPrivate` on the created `Project` (FR-011; depends on T020, T003)
- [X] T022 [US3] Extend the same handler to compute and persist `screenshotPaths` at import time using `src/lib/screenshots.ts` (T009) (FR-014; depends on T020, T009)
- [X] T023 [US3] Wire `RepoPicker`'s "confirm add" action (T016/T017) to submit the selected repo's URL through the modified `POST /api/projects` flow (FR-007, FR-008; depends on T017, T020)
- [X] T024 [US3] Modify `src/app/api/preview/[id]/[[...path]]/route.ts` to fetch via `fetchAuthenticatedFile` (T008) when `project.isPrivate` is true, and to return a distinct "no longer accessible" response when that fetch fails due to lost access (FR-011b, FR-011c; depends on T008, T021)
- [X] T025 [US3] Update the existing paste-a-URL add flow in `src/components/AddProjectModal.tsx` to prompt sign-in (via `AuthButton`) instead of submitting when the visitor is signed out (FR-009 edge case; depends on T011, T020)
- [ ] T026 [US3] Verify User Story 3 end-to-end per [quickstart.md](./quickstart.md) Scenario 3 and Scenario 5 (add a public and a private repo, duplicate resolves to the existing entry, catalog stays visible after sign-out, sign-in required to add)

**Checkpoint**: User Stories 1-3 all independently functional.

---

## Phase 6: User Story 4 - Screenshot gallery from repo images (Priority: P4)

**Goal**: Any catalog entry's detail page shows a gallery of PNG images found in its repository, if any exist.

**Independent Test**: Open the detail page of a repo containing PNGs and confirm a gallery renders; open one with none and confirm the page renders cleanly without it (spec.md User Story 4).

### Implementation for User Story 4

- [X] T027 [P] [US4] Implement `GET /api/projects/[id]/screenshots/[...path]` in `src/app/api/projects/[id]/screenshots/[...path]/route.ts`: validate the requested path against the project's cached `screenshotPaths`, serve bytes via the public or authenticated fetch path per `project.isPrivate`, `404`/`403` per [contracts/screenshots.md](./contracts/screenshots.md) (depends on T008, T009)
- [X] T028 [US4] Add lazy compute-and-backfill of `screenshotPaths` to the existing `GET /api/projects/[id]` handler in `src/app/api/projects/[id]/route.ts` when the column is still `null` (FR-016; [contracts/screenshots.md](./contracts/screenshots.md) trigger #2; depends on T009)
- [X] T029 [P] [US4] Create `src/components/ScreenshotGallery.tsx`: thumbnail grid sourced from T027's route, enlarging on selection, rendering nothing when there are no screenshots (FR-015, acceptance scenario 3)
- [X] T030 [US4] Render `ScreenshotGallery` on the project detail page in `src/app/projects/[id]/page.tsx` when `screenshotPaths` is non-empty (depends on T028, T029)
- [X] T031 [US4] Verify User Story 4 end-to-end per [quickstart.md](./quickstart.md) Scenario 4 (gallery for a repo with PNGs, no gallery for one without, lazy backfill for a pre-existing entry)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, quality gates, and the constitution follow-up flagged in plan.md.

- [X] T032 [P] Update `README.md` to document GitHub sign-in, private-repo selection, and the screenshot gallery, per constitution Development Workflow
- [X] T033 [P] Update `IMPLEMENTATION_NOTES.md` with this feature's key decisions and trade-offs (OAuth scope limitation, server-side token persistence rationale), per constitution Development Workflow
- [ ] T034 Run `npm run lint` and fix any issues
- [ ] T035 Run `npm test` and confirm `src/lib/screenshots.test.ts` (T010) and all existing suites pass
- [ ] T036 Run the full [quickstart.md](./quickstart.md) validation guide end-to-end (all 5 scenarios) as a final regression pass
- [X] T037 Amend `.specify/memory/constitution.md` Principle V to reflect the auth layer added by this feature (or run `/speckit-constitution`), per plan.md's Constitution Check note

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3-6)**: All depend on Foundational completion.
  - US1 has no dependency on US2-4.
  - US2 depends on T007 (Foundational) only, not on US1's UI — but in practice needs `AuthButton`/session state to gate the "select from my repos" tab, so is delivered after US1 for a coherent UX.
  - US3 depends on US2 (T016/T017's `RepoPicker`) for the "confirm add" wiring (T023), and reuses Foundational helpers directly for the rest.
  - US4 has no dependency on US1-3's auth work (it depends only on Foundational's T008/T009), but is sequenced last per spec.md's stated priority (P4, additive polish).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- Route/API tasks before the UI tasks that consume them.
- Story complete and independently verified (its quickstart scenario) before moving to the next priority.

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel.
- T004, T005, T007, T008, T009 (Foundational) can run in parallel once T003 is done; T006 and T010 each depend on one of those and follow.
- T011 (US1) and T015/T016 (US2, once Foundational is done) can be developed in parallel by different people, since US2's API/list UI don't require US1's components to exist yet — only the final "gate the tab on sign-in" step (T017) needs `AuthButton` (T011).
- T027 and T029 (US4) can run in parallel with each other and with any US1-3 work, since US4 only depends on Foundational.

---

## Parallel Example: Foundational Phase

```bash
# After T003 (schema/migration) completes, launch these together:
Task: "Create src/auth.ts Auth.js config"
Task: "Extend src/lib/github.ts with accessToken param + listUserRepos"
Task: "Create src/lib/github-content.ts with fetchAuthenticatedFile"
Task: "Create src/lib/screenshots.ts pure PNG-path helpers"
```

## Parallel Example: User Story 2

```bash
Task: "Implement GET /api/github/repos in src/app/api/github/repos/route.ts"
Task: "Create src/components/RepoPicker.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1
5. Demo: sign-in/sign-out works; the catalog itself is otherwise unchanged

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. User Story 1 → validate → demo (MVP: sign-in works)
3. User Story 2 → validate → demo (can browse your own repos)
4. User Story 3 → validate → demo (can actually add a picked repo — feature is now "done" per the original request)
5. User Story 4 → validate → demo (screenshot galleries — additive polish)
6. Polish phase → docs, lint, full regression pass, constitution follow-up

Given the dependency notes above, User Story 4 could technically be pulled forward (e.g., done in parallel with User Stories 1-3 by a second contributor) since it has no auth dependency — but is sequenced last here to match its P4 priority in spec.md.
