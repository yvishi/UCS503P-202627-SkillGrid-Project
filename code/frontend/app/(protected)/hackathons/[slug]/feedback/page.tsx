import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow, SectionCard } from "@/app/ui/primitives";
import { MAX_SKILLS_PER_TEAMMATE, feedbackWindow } from "@/lib/peer-feedback-core";
import { prisma } from "@/lib/prisma";
import { getUserSkills } from "@/lib/user-skills";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "SkillGrid – Peer feedback" };

export default async function FeedbackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = (await auth())!.user!.id!;

  const hackathon = await prisma.hackathon.findUnique({
    where: { slug },
    select: { id: true, name: true, endsAt: true },
  });
  if (!hackathon) notFound();

  const window = feedbackWindow(hackathon.endsAt, new Date());
  const membership = await prisma.teamMember.findUnique({
    where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
    select: { teamId: true },
  });

  let body: React.ReactNode;
  if (!membership) {
    body = <p className="text-sm text-ink-muted">You were not on a team in this hackathon, so there is no feedback to give.</p>;
  } else if (window !== "open") {
    body = (
      <p className="text-sm text-ink-muted">
        {window === "not-open"
          ? "Feedback opens when the hackathon ends."
          : "The feedback window for this hackathon has closed."}
      </p>
    );
  } else {
    const mates = await prisma.teamMember.findMany({
      where: { teamId: membership.teamId, userId: { not: userId } },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
    const cards = await Promise.all(
      mates.map(async ({ user }) => ({
        user,
        skills: (await getUserSkills(user.id)).slice(0, MAX_SKILLS_PER_TEAMMATE),
      })),
    );
    body =
      cards.length === 0 ? (
        <p className="text-sm text-ink-muted">You have no teammates to rate.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {cards.map(({ user, skills }) => (
            <SectionCard key={user.id} title={user.name ?? user.email ?? "Teammate"}>
              {skills.length === 0 ? (
                <p className="text-sm text-ink-muted">This teammate has not listed any skills yet.</p>
              ) : (
                <FeedbackForm hackathonSlug={slug} toUserId={user.id} skills={skills} />
              )}
            </SectionCard>
          ))}
        </div>
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <Eyebrow>Peer feedback</Eyebrow>
        <h1 className="mt-3 text-2xl font-semibold">{hackathon.name}</h1>
      </header>
      {body}
    </main>
  );
}
