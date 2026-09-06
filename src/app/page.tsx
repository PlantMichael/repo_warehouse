import { prisma } from "@/lib/prisma";
import Explorer from "@/components/Explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });

  return <Explorer initialProjects={projects} />;
}
