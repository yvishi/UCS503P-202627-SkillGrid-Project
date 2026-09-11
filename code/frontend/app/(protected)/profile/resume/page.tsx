import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const resumes: ResumeEntry[] = records.map((record) => {
    const payload = record.payload as {
      filename?: string;
      extractedSkills?: string[];
      usedOcr?: boolean;
    };
    return {
      id: record.id,
      filename: payload.filename ?? "resume.pdf",
      uploadedAt: record.createdAt.toISOString(),
      extractedSkills: payload.extractedSkills ?? [],
      usedOcr: payload.usedOcr ?? false,
      active: record.id === profile?.activeResumeId,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/dashboard"
          className="font-display text-sm font-medium text-ink-muted transition hover:text-trust"
        >
          ← Dashboard
        </Link>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight">Resumes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload a new resume to update your skills, or switch back to one you&apos;ve used before.
        </p>
      </div>

      <ResumeManager resumes={resumes} />
    </main>
  );
}
