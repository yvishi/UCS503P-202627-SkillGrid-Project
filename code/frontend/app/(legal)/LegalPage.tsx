import Link from "next/link";
import type { ReactNode } from "react";

export const CONTACT_URL = "https://github.com/yvishi/UCS503P-202627-SkillGrid-Project/issues";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
              <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-4" />
              <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-2" />
              <span className="h-[7px] w-[7px] rounded-[1.5px] bg-warm" />
              <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-3" />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-ink">SkillGrid</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 font-mono text-xs text-ink-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-muted [&_a]:text-ink [&_a]:underline [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="border-t border-border px-4 py-5 sm:px-6">
        <p className="mx-auto max-w-3xl font-mono text-[11px] text-ink-muted">
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · SkillGrid
        </p>
      </footer>
    </div>
  );
}
