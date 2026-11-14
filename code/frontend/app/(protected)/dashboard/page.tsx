import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GithubConnectionBanner } from "@/app/ui/ConnectGithubButton";
import { findOpenTeams, findTeammates } from "@/lib/discovery";
import { endGuide, getGuideFacts } from "@/lib/guide";
import { guideState, guideVisible, type GuideFacts, type GuideStepId } from "@/lib/guide-core";
import { getMyHackathons, getNeedsYou } from "@/lib/home-base";
import { prisma } from "@/lib/prisma";
import { listHackathons } from "@/lib/teams";

import { GuideView } from "./GuideView";
import { HomeBase } from "./HomeBase";
import { getSkillGrid } from "./grid-data";

export const metadata: Metadata = {
  title: "SkillGrid – Dashboard",
};

function countLabel(count: number, hasMore: boolean, one: string, many: string) {
  return `${count}${hasMore ? "+" : ""} ${count === 1 ? one : many}`;
}

// One-line summaries shown on finished guide steps.
function doneNotes(facts: GuideFacts): Partial<Record<GuideStepId, string>> {
  return {
    profile: `${facts.skillCount} ${facts.skillCount === 1 ? "skill" : "skills"}, ${facts.evidenceSources} of 2 evidence sources on file`,
    hackathon: "You've joined one.",
    team: facts.onTeam ? "You're on a team." : "You've reached out.",
    invites: "You know where they land.",
    feedback: facts.gaveFeedback ? "You've given feedback." : "You know how it works.",
  };
}

// The dashboard has two states. Until the getting-started guide ends, it
// is the guide: five steps, one open at a time. From then on it is the
// home base, which reports what is live and imposes no order. The guide
// never returns by itself; `?guide=1` shows it again on request.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string; guide?: string }>;
}) {
  // The (protected) layout redirects signed-out and un-onboarded users,
  // but pages render alongside layouts, so don't assume it ran first.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");
  const { github: githubStatus, guide: guideParam } = await searchParams;

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) redirect("/onboarding");

  const [grid, facts] = await Promise.all([
    getSkillGrid(userId, profile.activeResumeId),
    getGuideFacts(userId, profile),
  ]);
  const state = guideState(facts);
  // Finishing every step ends the guide for good, same as hiding it.
  if (state.allDone && !profile.guideEndedAt) await endGuide(userId);

  const guideLive = guideVisible(profile.guideEndedAt, state);
  const showGuide = guideLive || guideParam === "1";

  const name = session.user?.name ?? session.user?.email ?? "there";
  const firstName = name.split(" ")[0];

  let body: React.ReactNode;
  if (showGuide) {
    const [hackathons, needsYou] = await Promise.all([listHackathons(), getNeedsYou(userId)]);
    body = (
      <GuideView
        firstName={firstName}
        state={state}
        doneNotes={doneNotes(facts)}
        grid={grid}
        hackathons={hackathons.filter((h) => h.phase !== "ended")}
        feedbackHref={needsYou.find((item) => item.key.startsWith("feedback-"))?.href ?? null}
        review={!guideLive}
      />
    );
  } else {
    const [needsYou, hackathons, teammatePage, teamPage] = await Promise.all([
      getNeedsYou(userId),
      getMyHackathons(userId),
      findTeammates(userId, { skills: [], interest: null, availability: null, hackathon: null, page: 1 }),
      findOpenTeams(userId, { hackathon: null, skill: null, page: 1 }),
    ]);
    body = (
      <HomeBase
        firstName={firstName}
        grid={grid}
        needsYou={needsYou}
        hackathons={hackathons}
        peopleStat={countLabel(teammatePage.items.length, teammatePage.hasMore, "person", "people")}
        teamStat={countLabel(teamPage.items.length, teamPage.hasMore, "open team", "open teams")}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <GithubConnectionBanner status={githubStatus} />
      {body}
    </main>
  );
}
