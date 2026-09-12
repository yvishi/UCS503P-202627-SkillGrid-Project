import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_LABELS } from "@/lib/onboarding-options";
import { parseSkillRatings, skillLabel, SKILL_RATING_LABELS } from "@/lib/skills";

import { Avatar } from "@/app/ui/Avatar";
import { ConnectGithubButton, GithubConnectionBanner } from "@/app/ui/ConnectGithubButton";
import { Empty, EvidenceRow, Pill, SectionCard, TrustBadge } from "@/app/ui/primitives";

export const metadata: Metadata = {
  title: "SkillGrid – Profile",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string }>;
}) {
  // The (protected) layout already guarantees a signed-in, onboarded user
  // (i.e. a Profile row with onboardingCompletedAt set exists).
  const session = (await auth())!;
  const userId = session.user!.id!;
  const { github: githubStatus } = await searchParams;

  const [profileOrNull, evidence] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.evidenceRecord.findMany({
      where: { userId },
      select: { source: true, payload: true },
    }),
  ]);
  const profile = profileOrNull!;

  const name = session.user?.name ?? session.user?.email ?? "Your profile";
  const email = session.user?.email ?? "";
  const image = session.user?.image ?? null;

  const resumeUploaded = evidence.some((e) => e.source === "RESUME");
  const githubConnected = evidence.some(
    (e) => e.source === "GITHUB" && (e.payload as { verified?: boolean })?.verified === true,
  );
  const skillRatings = parseSkillRatings(profile.skillRatings);
  const ratedSkills = Object.entries(skillRatings) as [string, keyof typeof SKILL_RATING_LABELS][];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <GithubConnectionBanner status={githubStatus} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <Avatar name={name} image={image} />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {name}
          </h1>
          {email && <p className="text-sm text-ink-muted">{email}</p>}
          {profile.githubUsername && (
            <p className="mt-0.5 text-sm text-ink-muted">
              GitHub: <span className="font-medium text-ink">@{profile.githubUsername}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Bio ────────────────────────────────────────────────── */}
      {profile.bio && <p className="text-sm text-ink-muted">{profile.bio}</p>}

      {/* ── Skills + availability ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard title="Skills">
          {ratedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ratedSkills.map(([slug, level]) => (
                <Pill key={slug}>
                  {skillLabel(slug)} · {SKILL_RATING_LABELS[level]}
                </Pill>
              ))}
            </div>
          ) : (
            <Empty message="No skills rated" />
          )}
        </SectionCard>

        <SectionCard title="Availability">
          {profile.availability ? (
            <Pill>{AVAILABILITY_LABELS[profile.availability]}</Pill>
          ) : (
            <Empty message="Not set" />
          )}
        </SectionCard>
      </div>

      {/* ── Interests ──────────────────────────────────────────── */}
      <SectionCard title="Interests">
        {profile.interestTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.interestTags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        ) : (
          <Empty message="No interests selected" />
        )}
      </SectionCard>

      {/* ── Evidence ───────────────────────────────────────────── */}
      <SectionCard title="Evidence on file">
        <div className="flex flex-wrap gap-3">
          {resumeUploaded ? (
            <TrustBadge>Resume filed</TrustBadge>
          ) : (
            <EvidenceRow done={false}>No resume uploaded</EvidenceRow>
          )}
          {githubConnected ? (
            <TrustBadge>GitHub linked</TrustBadge>
          ) : (
            <ConnectGithubButton returnTo="/profile" className="px-3 py-1.5 text-xs" />
          )}
        </div>
      </SectionCard>

      {/* ── Project links ──────────────────────────────────────── */}
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
                    className="text-sm text-trust underline decoration-border-strong underline-offset-2 hover:decoration-trust"
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty message="No projects added" />
        )}
      </SectionCard>
    </main>
  );
}
