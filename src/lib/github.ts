const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GitHubError";
  }
}

export interface RepoRef {
  owner: string;
  name: string;
}

/**
 * Accepts a full GitHub URL (https://github.com/owner/repo, with or without
 * .git suffix, trailing slash, or extra path segments) and returns the owner
 * and repo name, or null if the input isn't a recognizable GitHub repo URL.
 */
export function parseRepoUrl(input: string): RepoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/, "");
  if (!owner || !name) return null;

  return { owner, name };
}

function authHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "project-warehouse-app",
    Accept: "application/vnd.github+json",
  };
  const token = accessToken ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubFetch(path: string, accessToken?: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders(accessToken) });

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GitHubError(
        "GitHub API rate limit exceeded. Set a GITHUB_TOKEN in .env to raise the limit, or try again later.",
        429
      );
    }
  }

  return res;
}

export interface RepoMetadata {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string;
  isPrivate: boolean;
}

export async function fetchRepoMetadata(ref: RepoRef, accessToken?: string): Promise<RepoMetadata> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}`, accessToken);

  if (res.status === 404) {
    throw new GitHubError(
      `Repository "${ref.owner}/${ref.name}" was not found. Check that the URL is correct and the repo is public.`,
      404
    );
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error (${res.status}) while fetching repo metadata.`, res.status);
  }

  const data = await res.json();
  return {
    owner: data.owner?.login ?? ref.owner,
    name: data.name ?? ref.name,
    description: data.description ?? null,
    language: data.language ?? null,
    stars: data.stargazers_count ?? 0,
    defaultBranch: data.default_branch ?? "main",
    isPrivate: data.private ?? false,
  };
}

export async function fetchReadme(
  ref: RepoRef,
  branch: string,
  accessToken?: string
): Promise<string | null> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}/readme?ref=${branch}`, accessToken);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.content) return null;

  try {
    return Buffer.from(data.content, data.encoding ?? "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * A repo is treated as a runnable static site if it has an index.html file
 * at its root. This intentionally does not attempt to detect or run build
 * steps (bundlers, package managers, etc.) - that would require executing
 * untrusted code server-side, which this app does not do.
 */
export async function checkStaticEntry(
  ref: RepoRef,
  branch: string,
  accessToken?: string
): Promise<string | null> {
  const res = await githubFetch(
    `/repos/${ref.owner}/${ref.name}/contents/index.html?ref=${branch}`,
    accessToken
  );
  if (!res.ok) return null;

  const data = await res.json();
  if (Array.isArray(data) || data.type !== "file") return null;

  return "index.html";
}

/**
 * Lists the entries in a repo's root directory (name/path/type), used for
 * screenshot discovery (research.md §6). Returns an empty array if the fetch
 * fails for any reason (e.g. empty repo) rather than throwing, since an empty
 * gallery is a normal, non-error outcome.
 */
export async function fetchRepoRootEntries(
  ref: RepoRef,
  branch: string,
  accessToken?: string
): Promise<Array<{ name: string; path: string; type: string }>> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}/contents/?ref=${branch}`, accessToken);
  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((entry) => ({
    name: entry.name as string,
    path: entry.path as string,
    type: entry.type as string,
  }));
}

export interface UserRepoSummary {
  name: string;
  fullName: string;
  description: string | null;
  updatedAt: string;
  isPrivate: boolean;
  url: string;
}

const REPOS_PER_PAGE = 30;

/**
 * Lists the authenticated user's own repositories (owner affiliation only,
 * public + private), per contracts/github-repos.md.
 */
export async function listUserRepos(
  accessToken: string,
  { q, page = 1 }: { q?: string; page?: number } = {}
): Promise<{ repos: UserRepoSummary[]; hasMore: boolean }> {
  const res = await githubFetch(
    `/user/repos?affiliation=owner&visibility=all&sort=updated&per_page=${REPOS_PER_PAGE}&page=${page}`,
    accessToken
  );

  if (res.status === 401 || res.status === 403) {
    throw new GitHubError(
      "Your GitHub authorization appears to have been revoked. Please sign in again.",
      401
    );
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error (${res.status}) while listing your repositories.`, res.status);
  }

  const data = await res.json();
  const repos: UserRepoSummary[] = (Array.isArray(data) ? data : [])
    .map((repo) => ({
      name: repo.name as string,
      fullName: repo.full_name as string,
      description: (repo.description as string | null) ?? null,
      updatedAt: repo.updated_at as string,
      isPrivate: Boolean(repo.private),
      url: repo.html_url as string,
    }))
    .filter((repo) => !q || repo.name.toLowerCase().includes(q.toLowerCase()));

  const linkHeader = res.headers.get("link") ?? "";
  const hasMore = /rel="next"/.test(linkHeader);

  return { repos, hasMore };
}

export async function fetchRawFile(
  ref: RepoRef,
  branch: string,
  path: string
): Promise<{ body: ArrayBuffer; status: number } | null> {
  const res = await fetch(`${GITHUB_RAW}/${ref.owner}/${ref.name}/${branch}/${path}`);
  if (!res.ok) return null;
  return { body: await res.arrayBuffer(), status: res.status };
}
