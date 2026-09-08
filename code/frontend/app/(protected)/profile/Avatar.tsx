"use client";

import { useEffect, useRef, useState } from "react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

// The stored avatar URL (Google's lh3.googleusercontent.com) can fail to
// load — rate limiting, an expired URL, or the user removing their photo.
// A null `image` is handled server-side, but a broken load only surfaces
// in the browser, so this falls back to initials on the `error` event.
export function Avatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The <img> is server-rendered, so a load failure can happen before
  // React hydrates and attaches onError. Re-check on mount.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={image}
        alt={name}
        className="h-16 w-16 rounded-full"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-lg font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      {initials(name)}
    </div>
  );
}
