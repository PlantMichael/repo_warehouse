import { NextRequest, NextResponse } from "next/server";
import { auth, getGitHubAccessToken } from "@/auth";
import { GitHubError, listUserRepos } from "@/lib/github";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in with GitHub to see your repositories." }, { status: 401 });
  }

  const accessToken = await getGitHubAccessToken(session.user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Your GitHub authorization appears to have been revoked. Please sign in again.", reauth: true },
      { status: 401 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const pageParam = req.nextUrl.searchParams.get("page");
  const page = pageParam ? Number.parseInt(pageParam, 10) || 1 : 1;

  try {
    const { repos, hasMore } = await listUserRepos(accessToken, { q, page });
    return NextResponse.json({ repos, hasMore });
  } catch (err) {
    if (err instanceof GitHubError) {
      if (err.status === 401) {
        return NextResponse.json({ error: err.message, reauth: true }, { status: 401 });
      }
      return NextResponse.json({ error: err.message }, { status: err.status === 429 ? 429 : 502 });
    }
    console.error("Failed to list user repos", err);
    return NextResponse.json(
      { error: "Unexpected error while listing your repositories." },
      { status: 502 }
    );
  }
}
