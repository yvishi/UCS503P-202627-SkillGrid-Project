import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findSkillNames } from "@/lib/skill-catalog";
import { expandLegacySlugs } from "@/lib/skill-normalize";

import { ResumeManager, type ResumeEntry } from "./ResumeManager";

export const metadata: Metadata = {
  title: "SkillGrid – Resumes",
};

export default async function ResumePage() {
  const session = (await auth())!;
  const userId = session.user!.id!;

  const [profile, records] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.evidenceRecord.findMany({
      where: { userId, source: "RESUME" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Old payloads may hold the two retired combined slugs; expand them so
  // each resolves to a catalog name.
  const slugsOf = (payload: unknown): string[] =>
    expandLegacySlugs((payload as { extractedSkills?: string[] }).extractedSkills ?? []);
  const names = await findSkillNames([...new Set(records.flatMap((r) => slugsOf(r.payload)))]);

  const resumes: ResumeEntry[] = records.map((record) => {
    const payload = record.payload as {
      filename?: string;
      usedOcr?: boolean;
    };
    return {
      id: record.id,
      filename: payload.filename ?? "resume.pdf",
      uploadedAt: record.createdAt.toISOString(),
      extractedSkills: slugsOf(record.payload).map((slug) => ({ slug, name: names.get(slug) ?? slug })),
      usedOcr: payload.usedOcr ?? false,
      active: record.id === profile?.activeResumeId,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <header className="border-b border-border pb-6">
        <Link
          href="/profile"
          className="rounded-theme-sm font-mono text-xs uppercase tracking-[0.12em] text-ink-muted transition hover:text-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust"
        >
          ← Profile
        </Link>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Resumes</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          The current resume is the one your skill evidence is read from. Upload a new one, or switch back to
          one you&apos;ve used before.
        </p>
      </header>

      <ResumeManager resumes={resumes} />
    </main>
  );
}
