import type { RepoRef } from "@/lib/github";

const GITHUB_API = "https://api.github.com";

/**
 * Fetches one file's raw bytes from a repository via the Contents API, using
 * a per-request access token in the Authorization header. Unlike
 * raw.githubusercontent.com (used for public repos), this works for private
 * repos the token's owner has access to. See research.md §5.
 */
export type AuthenticatedFileResult =
  | { ok: true; body: ArrayBuffer; status: number }
  | { ok: false; status: number };

export async function fetchAuthenticatedFile(
  ref: RepoRef,
  branch: string,
  path: string,
  accessToken: string
): Promise<AuthenticatedFileResult> {
  const res = await fetch(
    `${GITHUB_API}/repos/${ref.owner}/${ref.name}/contents/${path}?ref=${branch}`,
    {
      headers: {
        "User-Agent": "project-warehouse-app",
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, body: await res.arrayBuffer(), status: res.status };
}
