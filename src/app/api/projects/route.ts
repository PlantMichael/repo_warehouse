import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, getGitHubAccessToken } from "@/auth";
import {
  checkStaticEntry,
  fetchReadme,
  fetchRepoMetadata,
  fetchRepoRootEntries,
  GitHubError,
  parseRepoUrl,
} from "@/lib/github";
import { filterPngPaths } from "@/lib/screenshots";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const projects = await prisma.project.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { owner: { contains: q } },
            { description: { contains: q } },
            { language: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in with GitHub to add a repository." }, { status: 401 });
  }

  let body: { repoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const repoUrl = body.repoUrl?.trim();
  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl is required." }, { status: 400 });
  }

  const ref = parseRepoUrl(repoUrl);
  if (!ref) {
    return NextResponse.json(
      { error: "That doesn't look like a valid GitHub repository URL (expected https://github.com/owner/repo)." },
      { status: 400 }
    );
  }

  const existing = await prisma.project.findUnique({
    where: { repoUrl: `https://github.com/${ref.owner}/${ref.name}` },
  });
  if (existing) {
    return NextResponse.json({ project: existing, alreadyExisted: true }, { status: 200 });
  }

  const accessToken = (await getGitHubAccessToken(session.user.id)) ?? undefined;

  try {
    const metadata = await fetchRepoMetadata(ref, accessToken);
    const [readme, entryPath, rootEntries] = await Promise.all([
      fetchReadme(ref, metadata.defaultBranch, accessToken),
      checkStaticEntry(ref, metadata.defaultBranch, accessToken),
      fetchRepoRootEntries(ref, metadata.defaultBranch, accessToken),
    ]);
    const screenshotPaths = filterPngPaths(rootEntries);

    const project = await prisma.project.create({
      data: {
        owner: metadata.owner,
        name: metadata.name,
        repoUrl: `https://github.com/${metadata.owner}/${metadata.name}`,
        description: metadata.description,
        language: metadata.language,
        stars: metadata.stars,
        defaultBranch: metadata.defaultBranch,
        readme,
        isStatic: entryPath !== null,
        entryPath,
        importedByUserId: session.user.id,
        isPrivate: metadata.isPrivate,
        screenshotPaths: JSON.stringify(screenshotPaths),
        homepageUrl: metadata.homepage ?? "",
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status === 429 ? 429 : err.status });
    }
    console.error("Failed to import repo", err);
    return NextResponse.json({ error: "Unexpected error while importing the repository." }, { status: 502 });
  }
}
