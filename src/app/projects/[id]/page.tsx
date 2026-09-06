import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProjectWithBackfill } from "@/lib/projects";
import { parseScreenshotPaths } from "@/lib/screenshots";
import PreviewFrame from "@/components/PreviewFrame";
import DeleteButton from "@/components/DeleteButton";
import ScreenshotGallery from "@/components/ScreenshotGallery";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithBackfill(id);

  if (!project) {
    notFound();
  }

  const screenshotPaths = parseScreenshotPaths(project.screenshotPaths) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to warehouse
        </Link>
        <DeleteButton projectId={project.id} />
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-md border border-neutral-800 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Name</p>
              <p className="mt-1 font-medium">
                {project.owner}/{project.name}
              </p>
            </div>

            <div className="rounded-md border border-neutral-800 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Stack info</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                {project.language && <span>{project.language}</span>}
                <span>★ {project.stars.toLocaleString()}</span>
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  View on GitHub ↗
                </a>
              </div>
            </div>

            <div className="rounded-md border border-neutral-800 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Description</p>
              <p className="mt-1 text-sm text-neutral-300">
                {project.description ?? "No description provided."}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Project preview</p>
            {project.isStatic ? (
              <PreviewFrame src={`/api/preview/${project.id}/`} />
            ) : project.homepageUrl ? (
              <>
                <PreviewFrame src={project.homepageUrl} />
                <p className="mt-1 text-xs text-neutral-500">
                  Live demo at{" "}
                  <a
                    href={project.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    {project.homepageUrl}
                  </a>{" "}
                  (the repo&apos;s declared homepage) - not proxied/verified by Project Warehouse, unlike the
                  sandboxed preview for static sites.
                </p>
              </>
            ) : (
              <div className="h-[360px] flex items-center justify-center rounded-md border border-dashed border-neutral-700 p-4 text-center text-sm text-neutral-500">
                No preview available - this repo has no root <code className="mx-1">index.html</code> or
                declared homepage URL. Project Warehouse only runs static HTML/CSS/JS sites in-browser; it
                never executes code server-side.
              </div>
            )}
          </div>
        </div>
      </div>

      {screenshotPaths.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-2">Screenshots</h2>
          <ScreenshotGallery projectId={project.id} paths={screenshotPaths} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">README</h2>
        {project.readme ? (
          <article className="prose prose-invert prose-sm max-w-none rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.readme}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-neutral-500">No README found for this repository.</p>
        )}
      </section>
    </div>
  );
}
