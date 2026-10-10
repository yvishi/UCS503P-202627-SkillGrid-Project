import Link from "next/link";

import { SpotlightCard } from "@/app/ui/motion";
import { Eyebrow } from "@/app/ui/primitives";

// Entry point to a dashboard section (see DASHBOARD_SECTIONS in page.tsx).
// Every tile looks the same on purpose; the spotlight on hover is the only
// flourish. The whole card is one link, so focus lands on a single target.
export function NavTile({
  href,
  eyebrow,
  title,
  description,
  stat,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
}) {
  return (
    <SpotlightCard className="h-full rounded-theme-lg border border-border bg-surface transition-colors hover:border-border-strong">
      <Link href={href} className="group flex h-full flex-col gap-4 rounded-theme-lg p-5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="font-mono text-xs text-ink-muted">{stat}</span>
          <span
            aria-hidden="true"
            className="font-mono text-sm text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-trust"
          >
            →
          </span>
        </div>
      </Link>
    </SpotlightCard>
  );
}
