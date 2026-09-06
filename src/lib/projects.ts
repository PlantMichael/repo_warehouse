import type { Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGitHubAccessToken } from "@/auth";
import { fetchRepoRootEntries } from "@/lib/github";
import { filterPngPaths } from "@/lib/screenshots";

/**
 * Loads a project by id, lazily computing and persisting screenshotPaths on
 * first view if it hasn't been computed yet (FR-016; contracts/screenshots.md
 * trigger #2) - covers catalog entries added before this feature shipped.
 */
export async function getProjectWithScreenshotBackfill(id: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;
  if (project.screenshotPaths !== null) return project;

  const accessToken = project.importedByUserId
    ? await getGitHubAccessToken(project.importedByUserId)
    : undefined;
  const ref = { owner: project.owner, name: project.name };
  const rootEntries = await fetchRepoRootEntries(ref, project.defaultBranch, accessToken ?? undefined);
  const screenshotPaths = filterPngPaths(rootEntries);

  return prisma.project.update({
    where: { id },
    data: { screenshotPaths: JSON.stringify(screenshotPaths) },
  });
}
