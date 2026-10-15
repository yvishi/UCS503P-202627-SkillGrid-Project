import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEvidenceSnapshot } from "@/lib/evidence";
import { listOpenReports } from "@/lib/skill-requests";
import { getUserSkills } from "@/lib/user-skills";
import { Eyebrow } from "@/app/ui/primitives";
import { SkillPicker } from "@/app/ui/skill-picker/SkillPicker";

export const metadata: Metadata = {
  title: "SkillGrid – Your skills",
};

// Post-onboarding skill editing (spec 5.3) -- the same picker onboarding
// uses, so GitHub or resume evidence gathered later turns into one-click
// suggestions here.
export default async function ProfileSkillsPage() {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const userId = session.user!.id!;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { activeResumeId: true } });
  const [skills, reports, evidence] = await Promise.all([
    getUserSkills(userId),
    listOpenReports(userId),
    getEvidenceSnapshot(userId, profile?.activeResumeId ?? null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <Link
          href="/profile"
          className="rounded-theme-sm text-xs font-semibold text-ink-muted underline decoration-border-strong underline-offset-4 hover:text-ink"
        >
          ← Back to profile
        </Link>
        <Eyebrow className="mt-5">Skills</Eyebrow>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Your skills</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Add anything you know and rate how comfortable you are. Changes save as you go.
        </p>
      </header>
      <SkillPicker initial={{ skills, reports }} evidence={evidence} />
    </main>
  );
}
