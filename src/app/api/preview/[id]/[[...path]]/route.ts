import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRawFile } from "@/lib/github";
import { injectBase, isPathSafe, mimeFor } from "@/lib/preview";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> }
) {
  const { id, path: pathSegments } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !project.isStatic || !project.entryPath) {
    return NextResponse.json({ error: "This project has no runnable preview." }, { status: 404 });
  }

  const requestedPath = pathSegments && pathSegments.length > 0 ? pathSegments.join("/") : project.entryPath;

  if (!isPathSafe(requestedPath)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const ref = { owner: project.owner, name: project.name };
  const file = await fetchRawFile(ref, project.defaultBranch, requestedPath);

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
