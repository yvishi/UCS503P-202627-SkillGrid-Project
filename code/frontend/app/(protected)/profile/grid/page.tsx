import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import { Empty, Eyebrow } from "@/app/ui/primitives";
import { loadSkillGrid } from "@/lib/evidence";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SkillGrid – Your grid",
};

const linkClass = "rounded-theme-sm text-sm font-semibold text-trust underline underline-offset-4 hover:text-trust-strong";

// The whole skill grid, with nothing competing with it. The dashboard only
// previews the best-evidenced few skills and links here.
export default async function FullGridPage() {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const userId = (await auth())!.user!.id!;
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { activeResumeId: true } });
  const { grid } = await loadSkillGrid(userId, profile?.activeResumeId ?? null);
  const total = grid.rows.length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/dashboard"
          className="w-fit rounded-theme-sm font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← Dashboard
        </Link>
        <div>
          <Eyebrow>Your grid</Eyebrow>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Every skill, and what backs it
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            {total > 0
              ? `${grid.backedCount} of ${total} ${total === 1 ? "skill is" : "skills are"} backed by a resume, GitHub or a teammate. Strongest evidence first.`
              : "Nothing here yet."}
          </p>
        </div>
      </header>

      <section aria-label="Full skill grid" className="rounded-theme-lg border border-border bg-surface">
        <div className="bg-graph flex flex-col gap-5 p-5 sm:p-6">
          {total > 0 ? (
            <>
              <EvidenceGrid
                columns={grid.columns}
                rows={grid.rows}
                selfColumn={grid.selfColumn}
                size={total <= 8 ? "lg" : "md"}
                caption="All your skills by evidence source: self-rating, resume, GitHub and peers"
              />
              <GridLegend />
            </>
          ) : (
            <Empty message="No skills yet. Add some, upload a resume or connect GitHub and they'll appear here." />
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3">
          <Link href="/profile/skills" className={linkClass}>
            Edit skills
          </Link>
          <Link href="/profile/resume" className={linkClass}>
            Manage resumes
          </Link>
          <Link href="/profile" className={linkClass}>
            View profile
          </Link>
        </div>
      </section>
    </main>
  );
}
