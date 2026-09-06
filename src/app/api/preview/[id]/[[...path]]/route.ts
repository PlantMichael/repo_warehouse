import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRawFile } from "@/lib/github";

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
  map: "application/json; charset=utf-8",
};

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Injects a <base> tag so the browser resolves the entry HTML's relative
 * asset URLs (./styles.css, ./script.js, ...) back through this proxy route
 * instead of against the app's own origin.
 */
function injectBase(html: string, baseHref: string): string {
  const baseTag = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${baseTag}</head>`);
  }
  return `${baseTag}${html}`;
}

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

  if (requestedPath.split("/").some((segment) => segment === "..")) {
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
