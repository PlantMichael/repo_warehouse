import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getProjectWithBackfill } from "@/lib/projects";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const project = await getProjectWithBackfill(id);

  if (!project || !session?.user?.id || project.importedByUserId !== session.user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    const { count } = await prisma.project.deleteMany({
      where: { id, importedByUserId: session.user.id },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
