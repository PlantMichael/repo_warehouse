import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRawFile } from "@/lib/github";
import { fetchAuthenticatedFile } from "@/lib/github-content";
import { auth, getGitHubAccessToken } from "@/auth";
import { injectBase, isPathSafe, mimeFor } from "@/lib/preview";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> }
) {
  const { id, path: pathSegments } = await params;

  const session = await auth();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !session?.user?.id || project.importedByUserId !== session.user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (!project.isStatic || !project.entryPath) {
    return NextResponse.json({ error: "This project has no runnable preview." }, { status: 404 });
  }

  const requestedPath = pathSegments && pathSegments.length > 0 ? pathSegments.join("/") : project.entryPath;

  if (!isPathSafe(requestedPath)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const ref = { owner: project.owner, name: project.name };

  let file: { body: ArrayBuffer } | null;
  if (project.isPrivate) {
    const accessToken = project.importedByUserId
      ? await getGitHubAccessToken(project.importedByUserId)
      : null;
    if (!accessToken) {
      return NextResponse.json(
        { error: "This private repository's preview is no longer accessible." },
        { status: 403 }
      );
    }
    const result = await fetchAuthenticatedFile(ref, project.defaultBranch, requestedPath, accessToken);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          { error: "This private repository's preview is no longer accessible." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: `File not found: ${requestedPath}` }, { status: 404 });
    }
    file = { body: result.body };
  } else {
    file = await fetchRawFile(ref, project.defaultBranch, requestedPath);
  }

  if (!file) {
    return NextResponse.json({ error: `File not found: ${requestedPath}` }, { status: 404 });
  }

  const mime = mimeFor(requestedPath);

  if (mime.startsWith("text/html")) {
    const html = Buffer.from(file.body).toString("utf-8");
    const withBase = injectBase(html, `/api/preview/${id}/`);
    return new NextResponse(withBase, {
      status: 200,
      headers: { "Content-Type": mime },
    });
  }

  return new NextResponse(file.body, {
    status: 200,
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=60" },
  });
}
