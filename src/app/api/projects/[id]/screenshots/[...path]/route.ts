import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRawFile } from "@/lib/github";
import { fetchAuthenticatedFile } from "@/lib/github-content";
import { getGitHubAccessToken } from "@/auth";
import { isValidScreenshotPath, parseScreenshotPaths } from "@/lib/screenshots";
import { mimeFor } from "@/lib/preview";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path: pathSegments } = await params;
  const requestedPath = pathSegments.join("/");

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const cachedPaths = parseScreenshotPaths(project.screenshotPaths);
  if (!cachedPaths || !isValidScreenshotPath(requestedPath, cachedPaths)) {
    return NextResponse.json({ error: `Screenshot not found: ${requestedPath}` }, { status: 404 });
  }

  const ref = { owner: project.owner, name: project.name };

  let body: ArrayBuffer;
  if (project.isPrivate) {
    const accessToken = project.importedByUserId
      ? await getGitHubAccessToken(project.importedByUserId)
      : null;
    if (!accessToken) {
      return NextResponse.json(
        { error: "This screenshot is no longer accessible." },
        { status: 403 }
      );
    }
    const result = await fetchAuthenticatedFile(ref, project.defaultBranch, requestedPath, accessToken);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          { error: "This screenshot is no longer accessible." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: `Screenshot not found: ${requestedPath}` }, { status: 404 });
    }
    body = result.body;
  } else {
    const file = await fetchRawFile(ref, project.defaultBranch, requestedPath);
    if (!file) {
      return NextResponse.json({ error: `Screenshot not found: ${requestedPath}` }, { status: 404 });
    }
    body = file.body;
  }

  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": mimeFor(requestedPath), "Cache-Control": "public, max-age=60" },
  });
}
