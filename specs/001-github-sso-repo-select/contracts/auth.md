# Contract: Authentication

Handled by Auth.js's own route handler and conventions — this app does not define custom
request/response shapes for these, it configures Auth.js (`src/auth.ts`) and mounts its handler at
the standard catch-all route. Documented here for completeness / for `/speckit-tasks` to reference.

## `GET|POST /api/auth/[...nextauth]`

Auth.js's built-in routes, covering (among others):

| Path | Purpose |
|---|---|
| `GET /api/auth/signin` | Renders/redirects to the sign-in flow (this app links directly to the GitHub provider action instead of Auth.js's default multi-provider picker page, since GitHub is the only provider) |
| `GET /api/auth/signin/github` (via a form POST helper or `signIn("github")` client call) | Starts the GitHub OAuth authorization-code redirect (FR-001) |
| `GET /api/auth/callback/github` | GitHub redirects here after the user approves/denies; Auth.js exchanges the code for a token, persists/updates the `User`/`Account` (data-model.md), and sets the session cookie (FR-002) |
| `POST /api/auth/signout` | Ends the session (FR-003's "sign out") |
| `GET /api/auth/session` | Returns the current session's public shape (used by client components to know who's signed in) — **MUST NOT** include the raw access token (FR-013); Auth.js's default session callback already excludes it, and the Auth.js config in `src/auth.ts` MUST NOT be changed to add it back |

## Session shape (client-visible)

```jsonc
// GET /api/auth/session — signed in
{
  "user": {
    "name": "Ada Lovelace",
    "image": "https://avatars.githubusercontent.com/...",
    "githubLogin": "adalovelace"
  },
  "expires": "2026-10-05T00:00:00.000Z"
}
```

```jsonc
// GET /api/auth/session — signed out
{}
```

## Failure behavior (FR-002, FR-012)

| Scenario | Behavior |
|---|---|
| User denies/cancels the GitHub authorization prompt | Auth.js redirects back with an `error` query param; the sign-in UI reads this and shows "Sign-in was not completed" (or the specific reason if available) rather than leaving a blank/broken page |
| Session cookie present but the underlying GitHub token has been revoked | Not detected at session-read time (Auth.js doesn't validate the token on every request); detected reactively the next time server code tries to use the token (e.g., listing repos — see `github-repos.md`) and surfaced as a "please sign in again" message, per FR-012 |
