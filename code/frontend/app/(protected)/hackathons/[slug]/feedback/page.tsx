import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow, Pill, buttonBase, secondaryButtonClass } from "@/app/ui/primitives";
import { FEEDBACK_WINDOW_DAYS, MAX_SKILLS_PER_TEAMMATE, feedbackWindow } from "@/lib/peer-feedback-core";
import { prisma } from "@/lib/prisma";
import type { SkillRatingLevel } from "@/lib/skills";
import { getUserSkills } from "@/lib/user-skills";

import { formatIst } from "../../format";
import { FeedbackFlow, type FeedbackMate } from "./FeedbackForm";

export const metadata: Metadata = { title: "SkillGrid – Peer feedback" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ to?: string | string[] }>;
}) {
  const { slug } = await params;
  const { to } = await searchParams;
  const userId = (await auth())!.user!.id!;

  const hackathon = await prisma.hackathon.findUnique({
    where: { slug },
    select: { id: true, name: true, endsAt: true },
  });
  if (!hackathon) notFound();

  const hackathonHref = `/hackathons/${slug}`;
  const now = new Date();
  const window = feedbackWindow(hackathon.endsAt, now);
  const closesAt = new Date(hackathon.endsAt.getTime() + FEEDBACK_WINDOW_DAYS * DAY_MS);
  const daysLeft = Math.max(1, Math.ceil((closesAt.getTime() - now.getTime()) / DAY_MS));

  const membership = await prisma.teamMember.findUnique({
    where: { hackathonId_userId: { hackathonId: hackathon.id, userId } },
    select: { teamId: true, team: { select: { name: true } } },
  });

  let body: React.ReactNode;
  if (!membership) {
    body = (
      <Notice
        title="Nothing to rate here"
        text="You were not on a team in this hackathon, so there is no feedback to give."
        hackathonHref={hackathonHref}
      />
    );
  } else if (window !== "open") {
    body = (
      <Notice
        title={window === "not-open" ? "Feedback isn't open yet" : "Feedback has closed"}
        text={
          window === "not-open"
            ? `Feedback opens when the hackathon ends (${formatIst(hackathon.endsAt)}) and stays open for ${FEEDBACK_WINDOW_DAYS} days.`
            : `The feedback window closed on ${formatIst(closesAt)}.`
        }
        hackathonHref={hackathonHref}
      />
    );
  } else {
    const [mates, given] = await Promise.all([
      prisma.teamMember.findMany({
        where: { teamId: membership.teamId, userId: { not: userId } },
        select: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.peerFeedback.findMany({
        where: { hackathonId: hackathon.id, fromUserId: userId },
        select: { toUserId: true, level: true, skill: { select: { slug: true } } },
      }),
    ]);

    const savedByMate = new Map<string, Record<string, SkillRatingLevel>>();
    for (const row of given) {
      const entry = savedByMate.get(row.toUserId) ?? {};
      entry[row.skill.slug] = row.level;
      savedByMate.set(row.toUserId, entry);
    }

    const cards: FeedbackMate[] = await Promise.all(
      mates.map(async ({ user }) => {
        const skills = (await getUserSkills(user.id))
          .slice(0, MAX_SKILLS_PER_TEAMMATE)
          .map(({ slug, name }) => ({ slug, name }));
        const allowed = new Set(skills.map((s) => s.slug));
        const saved = Object.fromEntries(
          Object.entries(savedByMate.get(user.id) ?? {}).filter(([s]) => allowed.has(s)),
        );
        return { id: user.id, name: user.name ?? user.email ?? "Teammate", image: user.image, skills, saved };
      }),
    );

    body =
      cards.length === 0 ? (
        <Notice
          title="No teammates to rate"
          text="You were the only member of your team, so there is no one to give feedback to."
          hackathonHref={hackathonHref}
        />
      ) : (
        <FeedbackFlow
          hackathonSlug={slug}
          hackathonHref={hackathonHref}
          mates={cards}
          initialMateId={typeof to === "string" ? to : null}
        />
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink-muted">
            <li>
              <Link href="/hackathons" className="rounded-theme-sm transition-colors hover:text-trust">
                Hackathons
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="min-w-0">
              <Link href={hackathonHref} className="block max-w-[16rem] truncate rounded-theme-sm transition-colors hover:text-trust">
                {hackathon.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              Peer feedback
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Peer feedback</Eyebrow>
              {membership && window === "open" && (
                <Pill tone="warm">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                </Pill>
              )}
            </div>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{hackathon.name}</h1>
            {membership && window === "open" && (
              <p className="mt-2 max-w-xl text-sm text-ink-muted">
                Rate how each teammate on <span className="font-medium text-ink">{membership.team.name}</span> actually
                performed on the skills they list. Your ratings become peer evidence on their skill grid. You can edit
                them until <span className="font-mono text-xs">{formatIst(closesAt)}</span>.
              </p>
            )}
          </div>
          <Link href={hackathonHref} className={`${buttonBase} ${secondaryButtonClass} w-fit shrink-0`}>
            ← Back to hackathon
          </Link>
        </div>
      </header>

      {body}
    </main>
  );
}

function Notice({ title, text, hackathonHref }: { title: string; text: string; hackathonHref: string }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-theme-lg border border-dashed border-border-strong bg-surface p-6 sm:p-8">
      <span aria-hidden="true" className="flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3 w-3 rounded-[3px] border border-dashed border-border-strong" />
        ))}
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 max-w-lg text-sm text-ink-muted">{text}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={hackathonHref} className={`${buttonBase} ${secondaryButtonClass}`}>
          Back to hackathon
        </Link>
        <Link href="/dashboard" className={`${buttonBase} ${secondaryButtonClass}`}>
          Go to dashboard
        </Link>
      </div>
    </section>
  );
}
