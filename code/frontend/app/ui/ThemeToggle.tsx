"use client";

import { useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "skillgrid-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Lets someone pin light or dark explicitly, overriding the system
// default set in app/layout.tsx's no-flash script. Reflects the actual
// applied theme rather than assuming light on first render, since the
// stored preference could be either.
export function ThemeToggle() {
  // Lazy initializer runs once on mount (and once during SSR, where it
  // falls back to "light"). The inline no-flash script in app/layout.tsx
  // has already set data-theme on <html> before hydration, so the icon
  // can briefly mismatch server vs. client -- suppressed below since it's
  // cosmetic only and self-corrects on the next render.
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable (private mode, blocked storage) --
      // the toggle still works for this page load via the DOM attribute.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted transition hover:border-border-strong hover:text-ink"
      suppressHydrationWarning
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M20.4 14.7A8.5 8.5 0 0 1 9.3 3.6a.5.5 0 0 0-.6-.7 9.5 9.5 0 1 0 12.4 12.4.5.5 0 0 0-.7-.6Z" />
        </svg>
      )}
    </button>
  );
}
