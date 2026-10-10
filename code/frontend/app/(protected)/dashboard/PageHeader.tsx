import Link from "next/link";

import { Eyebrow } from "@/app/ui/primitives";

// Shared header for the dashboard's listing pages (teammates, teams).
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="w-fit rounded-theme-sm font-mono text-xs text-ink-muted transition-colors hover:text-trust"
      >
        ← Dashboard
      </Link>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">{description}</p>
      </div>
    </header>
  );
}

// The listings are fixtures until matching ships; say so plainly.
export function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-theme-md border border-dashed border-border-strong bg-surface-alt px-4 py-3 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-3 w-3 shrink-0 rounded-[3px] border border-dashed border-ink-muted"
      />
      <span>{children}</span>
    </p>
  );
}
