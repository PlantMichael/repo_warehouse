import type { Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGitHubAccessToken } from "@/auth";
import { fetchRepoMetadata, fetchRepoRootEntries } from "@/lib/github";
import { filterPngPaths } from "@/lib/screenshots";

/**
 * Loads a project by id, lazily computing and persisting screenshotPaths
 * and/or homepageUrl on first view if either hasn't been computed yet
 * (FR-016; contracts/screenshots.md trigger #2) - covers catalog entries
 * added before those fields existed.
 */
export async function getProjectWithBackfill(id: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;
  const needsBackfill =
    project.screenshotPaths === null || project.homepageUrl === null || project.topics === null;
  if (!needsBackfill) return project;

  const accessToken = project.importedByUserId
    ? await getGitHubAccessToken(project.importedByUserId)
    : undefined;
  const ref = { owner: project.owner, name: project.name };

  const data: {
    screenshotPaths?: string;
    homepageUrl?: string;
    license?: string | null;
    topics?: string;
    openIssues?: number;
    repoUpdatedAt?: Date | null;
  } = {};

  if (project.screenshotPaths === null) {
    const rootEntries = await fetchRepoRootEntries(ref, project.defaultBranch, accessToken ?? undefined);
    data.screenshotPaths = JSON.stringify(filterPngPaths(rootEntries));
  }

  if (project.homepageUrl === null || project.topics === null) {
    try {
      const metadata = await fetchRepoMetadata(ref, accessToken ?? undefined);
      data.homepageUrl = metadata.homepage ?? "";
      data.license = metadata.license;
      data.topics = JSON.stringify(metadata.topics);
      data.openIssues = metadata.openIssues;
      data.repoUpdatedAt = metadata.repoUpdatedAt ? new Date(metadata.repoUpdatedAt) : null;
    } catch {
      data.homepageUrl = project.homepageUrl ?? "";
      data.topics = "[]";
    }
  }

  return prisma.project.update({ where: { id }, data });
}
