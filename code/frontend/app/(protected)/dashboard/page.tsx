import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_LABELS } from "@/lib/onboarding-options";
import { parseSkillRatings, skillLabel } from "@/lib/skills";
import { TEAMMATE_FIXTURES, TEAM_FIXTURES } from "@/lib/dashboard-fixtures";

import { Avatar } from "@/app/ui/Avatar";
import {
  Empty,
  EvidenceRow,
  Pill,
  ProgressBar,
  SecondaryButton,
  SectionCard,
  StatCard,
} from "@/app/ui/primitives";
import { TeamCard, TeammateCard } from "./MatchCards";

export const metadata: Metadata = {
  title: "SkillGrid – Dashboard",
};

const TOTAL_EVIDENCE_SOURCES = 2; // Resume + GitHub, for now (see EvidenceSource enum).

export default async function DashboardPage() {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const userId = session.user!.id!;

  const [profileOrNull, evidence] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.evidenceRecord.findMany({
      where: { userId },
      select: { source: true },
    }),
  ]);
  const profile = profileOrNull!;

  const name = session.user?.name ?? session.user?.email ?? "there";
  const firstName = name.split(" ")[0];
  const image = session.user?.image ?? null;

  const resumeUploaded = evidence.some((e) => e.source === "RESUME");
  const githubConnected = evidence.some((e) => e.source === "GITHUB");
  const connectedCount = [resumeUploaded, githubConnected].filter(
    Boolean,
  ).length;
  const skillRatings = parseSkillRatings(profile.skillRatings);
  const ratedSkillSlugs = Object.keys(skillRatings);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* ── Welcome ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here&apos;s where your SkillGrid profile stands today.
          </p>
        </div>
        <Avatar name={name} image={image} />
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Evidence connected"
          value={`${connectedCount}/${TOTAL_EVIDENCE_SOURCES}`}
          hint="Resume & GitHub"
        />
        <StatCard
          label="Interests"
          value={String(profile.interestTags.length)}
          hint={
            profile.interestTags.length > 0
              ? profile.interestTags.slice(0, 2).join(", ")
              : "None selected yet"
          }
        />
        <StatCard
          label="Skills on file"
          value={String(ratedSkillSlugs.length)}
          hint={
            ratedSkillSlugs.length > 0
              ? ratedSkillSlugs.slice(0, 2).map(skillLabel).join(", ")
              : "None rated yet"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ──────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard title="Evidence checklist">
            <div className="mb-4">
              <ProgressBar fraction={connectedCount / TOTAL_EVIDENCE_SOURCES} />
            </div>
            <ul className="flex flex-col gap-2">
              <EvidenceRow done={resumeUploaded}>
                {resumeUploaded ? "Resume uploaded" : "No resume uploaded"}
              </EvidenceRow>
              <EvidenceRow done={githubConnected}>
                {githubConnected ? "GitHub connected" : "GitHub not connected"}
              </EvidenceRow>
              <EvidenceRow done={false} disabled>
                LinkedIn — coming soon
              </EvidenceRow>
              <EvidenceRow done={false} disabled>
                Peer feedback — coming soon
              </EvidenceRow>
            </ul>
          </SectionCard>

          {/* ── Find Teammates ───────────────────────────────────── */}
          <SectionCard
            title="Find teammates"
            action={<span className="text-xs text-ink-muted">Sample listing</span>}
          >
            <div className="flex flex-col gap-3">
              {TEAMMATE_FIXTURES.map((teammate) => (
                <TeammateCard key={teammate.id} teammate={teammate} />
              ))}
            </div>
          </SectionCard>

          {/* ── Find a Team ──────────────────────────────────────── */}
          <SectionCard
            title="Find a team"
            action={<span className="text-xs text-ink-muted">Sample listing</span>}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TEAM_FIXTURES.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Projects">
            {profile.projectLinks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {profile.projectLinks.map((link) => {
                  let display = link;
                  try {
                    const url = new URL(link);
                    display = url.hostname + url.pathname;
                  } catch {
                    // leave as-is if URL parsing fails
                  }
                  return (
                    <li key={link}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                      >
                        {display}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty message="No projects added yet" />
            )}
          </SectionCard>
        </div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              <Link href="/profile">
                <SecondaryButton type="button" className="w-full">
                  View full profile
                </SecondaryButton>
              </Link>
              <SecondaryButton type="button" disabled title="Coming soon">
                Connect GitHub (coming soon)
              </SecondaryButton>
              <SecondaryButton type="button" disabled title="Coming soon">
                Re-upload resume (coming soon)
              </SecondaryButton>
            </div>
          </SectionCard>

          <SectionCard title="Availability">
            {profile.availability ? (
              <Pill>{AVAILABILITY_LABELS[profile.availability]}</Pill>
            ) : (
              <Empty message="Not set" />
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
