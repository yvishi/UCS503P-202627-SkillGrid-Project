import Link from "next/link";

// Cycle through the theme's accent colors so a new dashboard section
// (see DASHBOARD_SECTIONS in page.tsx) just takes the next one instead
// of needing a color picked for it.
const ACCENTS = ["trust", "warm", "success", "gold"] as const;
export type TileAccent = (typeof ACCENTS)[number];

export function tileAccent(index: number): TileAccent {
  return ACCENTS[index % ACCENTS.length];
}

export function NavTile({
  href,
  eyebrow,
  title,
  description,
  stat,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
  accent: TileAccent;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderTop: `4px solid var(--${accent})`, borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}
    >
      <span
        className="font-display inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
        style={{ backgroundColor: `color-mix(in srgb, var(--${accent}) 15%, transparent)`, color: `var(--${accent}-strong, var(--${accent}))` }}
      >
        {eyebrow}
      </span>
      <div>
        <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="font-display text-xs text-ink-muted">{stat}</span>
        <span className="font-display flex h-7 w-7 items-center justify-center rounded-full bg-surface-alt text-sm transition group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
