"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/hackathons", label: "Hackathons" },
  { href: "/invites", label: "Invites" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Active state is drawn as a filled evidence cell under the label, so the
// nav speaks the same visual language as the grid.
// `pendingInvites` is counted on the server (NavBar) and shown next to "Invites".
export function NavLinks({ className = "", pendingInvites = 0 }: { className?: string; pendingInvites?: number }) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-theme-sm px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-[2px] transition-colors ${
                    active ? "bg-trust" : "border border-border-strong"
                  }`}
                />
                {label}
                {href === "/invites" && pendingInvites > 0 && (
                  <span className="rounded-theme-sm bg-trust px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-on-trust">
                    {pendingInvites}
                    <span className="sr-only"> pending</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
