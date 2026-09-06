import Link from "next/link";
import type { Project } from "@prisma/client";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500 truncate">{project.owner}</p>
          <h3 className="font-medium truncate">{project.name}</h3>
        </div>
        {project.isStatic && (
          <span className="shrink-0 rounded-full bg-emerald-900/50 text-emerald-300 text-xs px-2 py-0.5 border border-emerald-800">
            ▶ Runnable
          </span>
        )}
      </div>

      {project.description && (
        <p className="mt-2 text-sm text-neutral-400 line-clamp-2">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
        {project.language && <span>{project.language}</span>}
        <span>★ {project.stars.toLocaleString()}</span>
      </div>
    </Link>
  );
}
