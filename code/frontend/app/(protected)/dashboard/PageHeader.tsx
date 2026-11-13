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
