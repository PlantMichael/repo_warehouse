import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Explorer from "@/components/Explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const projects = session?.user?.id
    ? await prisma.project.findMany({
        where: { importedByUserId: session.user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return <Explorer initialProjects={projects} />;
}
