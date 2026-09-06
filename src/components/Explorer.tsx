"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";
import ProjectCard from "./ProjectCard";
import AddProjectModal from "./AddProjectModal";

export default function Explorer({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [isSearching, startSearch] = useTransition();

  async function search(q: string) {
    const res = await fetch(`/api/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    setProjects(data.projects ?? []);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    startSearch(() => {
      search(value);
    });
  }

  function handleCreated(projectId: string) {
    setModalOpen(false);
    router.push(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Repo Warehouse</h1>
        <p className="mt-1 text-neutral-400">
          Your personal storage for GitHub repos — yours or anyone else&apos;s. Sign in with GitHub and link
          any repo URL; it&apos;s saved to your account only, no one else sees it. Static sites (with a root{" "}
          <code>index.html</code>) get a live sandboxed preview, and every project can be downloaded as a
          zip straight from GitHub.
        </p>
      </section>

      <section>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, owner, language, or description…"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
          <button
            onClick={() => setModalOpen(true)}
            aria-label="Add a repository"
            title="Add a repository"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 hover:border-neutral-500 text-xl leading-none"
          >
            +
          </button>
        </div>

        <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${isSearching ? "opacity-60" : ""}`}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {projects.length === 0 && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            {query ? "No projects match your search." : "No projects yet — click + to add one."}
          </p>
        )}
      </section>

      {modalOpen && <AddProjectModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}
