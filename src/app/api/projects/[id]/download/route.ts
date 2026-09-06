import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, getGitHubAccessToken } from "@/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project || !session?.user?.id || project.importedByUserId !== session.user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const accessToken = project.importedByUserId
    ? await getGitHubAccessToken(project.importedByUserId)
    : null;

  const headers: Record<string, string> = {
    "User-Agent": "project-warehouse-app",
    Accept: "application/vnd.github+json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(
    `https://api.github.com/repos/${project.owner}/${project.name}/zipball/${project.defaultBranch}`,
    { headers, redirect: "follow" }
  );

  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: "Could not download the zip from GitHub." },
      { status: res.status === 404 ? 404 : 502 }
    );
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.owner}-${project.name}-${project.defaultBranch}.zip"`,
    },
  });
}
