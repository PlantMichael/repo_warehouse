"use client";

import { useEffect, useState } from "react";

interface UserRepoSummary {
  name: string;
  fullName: string;
  description: string | null;
  updatedAt: string;
  isPrivate: boolean;
  url: string;
}

export default function RepoPicker({
  onPick,
  submitting,
}: {
  onPick: (url: string) => void;
  submitting: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    repos: UserRepoSummary[];
    hasMore: boolean;
    error: string | null;
  } | null>(null);

  const key = `${query}:${page}`;
  const loading = result?.key !== key;
  const repos = loading ? [] : result!.repos;
  const hasMore = loading ? false : result!.hasMore;
  const error = loading ? null : result!.error;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/github/repos?q=${encodeURIComponent(query)}&page=${page}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setResult({
            key,
            repos: [],
            hasMore: false,
            error: data.error ?? "Something went wrong while loading your repositories.",
          });
          return;
        }
        setResult({ key, repos: data.repos ?? [], hasMore: Boolean(data.hasMore), error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key, repos: [], hasMore: false, error: "Network error - could not reach the server." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, page, key]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Filter your repositories by name…"
        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500 py-4 text-center">Loading your repositories…</p>
      ) : repos.length === 0 && !error ? (
        <p className="text-sm text-neutral-500 py-4 text-center">
          {query ? "No repositories match that filter." : "You don't have any GitHub repositories yet."}
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto rounded-md border border-neutral-800 divide-y divide-neutral-800">
          {repos.map((repo) => (
            <li key={repo.fullName} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{repo.name}</span>
                  {repo.isPrivate && (
                    <span className="shrink-0 rounded-full bg-neutral-800 text-neutral-400 text-[10px] px-1.5 py-0.5 border border-neutral-700">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-neutral-500 truncate">{repo.description}</p>
                )}
              </div>
              <button
                onClick={() => onPick(repo.url)}
                disabled={submitting}
                className="shrink-0 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-xs font-medium"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && (repos.length > 0 || page > 1) && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="disabled:opacity-30"
          >
            ← Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
