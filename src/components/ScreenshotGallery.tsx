"use client";

import { useState } from "react";

export default function ScreenshotGallery({
  projectId,
  paths,
}: {
  projectId: string;
  paths: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  function srcFor(path: string) {
    return `/api/projects/${projectId}/screenshots/${path}`;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {paths.map((path) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={path}
            src={srcFor(path)}
            alt={path}
            onClick={() => setSelected(path)}
            className="w-full h-32 object-cover rounded-md border border-neutral-800 cursor-pointer hover:border-neutral-600"
          />
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setSelected(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={srcFor(selected)}
            alt={selected}
            className="max-h-[85vh] max-w-full rounded-md border border-neutral-700"
          />
        </div>
      )}
    </>
  );
}
