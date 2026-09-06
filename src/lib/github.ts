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

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "project-warehouse-app",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders() });

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
}

export async function fetchRepoMetadata(ref: RepoRef): Promise<RepoMetadata> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}`);

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
  };
}

export async function fetchReadme(ref: RepoRef, branch: string): Promise<string | null> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}/readme?ref=${branch}`);
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
export async function checkStaticEntry(ref: RepoRef, branch: string): Promise<string | null> {
  const res = await githubFetch(`/repos/${ref.owner}/${ref.name}/contents/index.html?ref=${branch}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (Array.isArray(data) || data.type !== "file") return null;

  return "index.html";
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
