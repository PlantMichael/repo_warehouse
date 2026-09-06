"use client";

import { useState } from "react";

export default function PreviewFrame({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative rounded-md border border-neutral-800 overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500 bg-neutral-900">
          Loading preview…
        </div>
      )}
      <iframe
        src={src}
        sandbox="allow-scripts"
        onLoad={() => setLoaded(true)}
        className="w-full h-[360px] md:h-full bg-white"
        title="Live preview"
      />
    </div>
  );
}
