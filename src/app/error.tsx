"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-neutral-400">An unexpected error occurred while loading this page.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
