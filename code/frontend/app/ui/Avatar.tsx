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
  size = "h-16 w-16 text-lg",
}: {
  name: string;
  image: string | null;
  size?: string;
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
        className={`${size} shrink-0 rounded-full border border-border-strong`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`font-display flex ${size} shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-alt font-semibold text-ink`}
    >
      {initials(name)}
    </div>
  );
}
