"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Remove this project from the warehouse? This only deletes the catalog entry, not the GitHub repo.")) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete project.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error - could not reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {deleting ? "Removing…" : "Remove from warehouse"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
