"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import AuthButton from "./AuthButton";
import RepoPicker from "./RepoPicker";

export default function AddProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"url" | "repos">("url");
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function submitRepoUrl(url: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong while importing that repo.");
        return;
      }

      onCreated(data.project.id);
    } catch {
      setError("Network error - could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError("Enter a GitHub repository URL.");
      return;
    }
    submitRepoUrl(repoUrl);
  }

  const signedIn = status === "authenticated" && Boolean(session?.user);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-medium">Add a repository</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-500 hover:text-neutral-300 leading-none text-xl"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          Static sites (root <code>index.html</code>) get a live sandboxed preview; everything else is cataloged
          with its README and metadata.
        </p>

        {status !== "loading" && !signedIn ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-dashed border-neutral-700 p-6 text-center">
            <p className="text-sm text-neutral-400">Sign in with GitHub to add a repository.</p>
            <AuthButton />
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-1 border-b border-neutral-800">
              <button
                onClick={() => setTab("url")}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${
                  tab === "url"
                    ? "border-emerald-500 text-neutral-100"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Paste URL
              </button>
              <button
                onClick={() => setTab("repos")}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${
                  tab === "repos"
                    ? "border-emerald-500 text-neutral-100"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                My repos
              </button>
            </div>

            {tab === "url" ? (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
                  disabled={submitting}
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium"
                >
                  {submitting ? "Importing…" : "Add repo"}
                </button>
              </form>
            ) : (
              <div className="mt-4">
                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                <RepoPicker onPick={submitRepoUrl} submitting={submitting} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
