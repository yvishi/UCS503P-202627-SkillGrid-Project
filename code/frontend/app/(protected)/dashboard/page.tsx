import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEvidenceStatus } from "@/lib/evidence";
import { AVAILABILITY_LABELS } from "@/lib/onboarding-options";
import { parseSkillRatings, skillLabel } from "@/lib/skills";
import { TEAMMATE_FIXTURES, TEAM_FIXTURES } from "@/lib/dashboard-fixtures";

import { ConnectGithubButton, GithubConnectionBanner } from "@/app/ui/ConnectGithubButton";
import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import { CountUp, Reveal } from "@/app/ui/motion";
import {
  Empty,
  Eyebrow,
  EvidenceRow,
  Pill,
  ProgressBar,
  SecondaryButton,
  SectionCard,
  StatCard,
  buttonBase,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/ui/primitives";
import { NavTile } from "./NavTile";
import { GRID_COLUMNS, getSkillGrid } from "./grid-data";

export const metadata: Metadata = {
  title: "SkillGrid – Dashboard",
};

const TOTAL_EVIDENCE_SOURCES = 2; // Resume + GitHub, for now (see EvidenceSource enum).

// One entry per dashboard section -- adding a new one (e.g. "AI Team
// Builder") is just another entry here.
const DASHBOARD_SECTIONS = [
  {
    href: "/dashboard/teammates",
    eyebrow: "People",
    title: "Find teammates",
    description: "Browse students building a profile and looking for a team.",
    stat: `${TEAMMATE_FIXTURES.length} sample profiles`,
  },
  {
    href: "/dashboard/teams",
    eyebrow: "Groups",
    title: "Find a team",
    description: "Browse teams with an open slot for a hackathon or project.",
    stat: `${TEAM_FIXTURES.length} sample teams`,
  },
];

const linkButton = `${buttonBase} ${secondaryButtonClass} w-full`;

function SourceNote({
  name,
  swatch,
  children,
}: {
  name: string;
  swatch: "self" | "evidence" | "empty";
  children: React.ReactNode;
}) {
  const swatchClass =
    swatch === "self"
      ? "bg-warm"
      : swatch === "evidence"
        ? "bg-cell-3"
        : "border border-dashed border-border-strong";
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-[3px] ${swatchClass}`} />
      <div className="min-w-0">
        <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink">{name}</dt>
        <dd className="mt-0.5 text-sm text-ink-muted">{children}</dd>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string }>;
}) {
  // The (protected) layout already guarantees a signed-in, onboarded user.
  const session = (await auth())!;
  const userId = session.user!.id!;
  const { github: githubStatus } = await searchParams;

  const [profileOrNull, { resumeUploaded, githubConnected }] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    getEvidenceStatus(userId),
  ]);
  const profile = profileOrNull!;
  const grid = await getSkillGrid(userId, profile);

  const name = session.user?.name ?? session.user?.email ?? "there";
  const firstName = name.split(" ")[0];

  const connectedCount = [resumeUploaded, githubConnected].filter(Boolean).length;
  const skillRatings = parseSkillRatings(profile.skillRatings);
  const ratedSkillSlugs = Object.keys(skillRatings);
  const gridSize = grid.rows.length <= 8 ? "lg" : "md";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <GithubConnectionBanner status={githubStatus} />

      {/* ── Welcome ────────────────────────────────────────────── */}
      <header>
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every filled cell below is backed by something on file. Here&apos;s where yours stands.
        </p>
      </header>

      {/* ── Your grid (hero) ───────────────────────────────────── */}
      <Reveal>
        <section
          aria-labelledby="your-grid-heading"
          className="bg-graph overflow-hidden rounded-theme-lg border border-border bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
            <h2 id="your-grid-heading">
              <Eyebrow className="text-ink">Your grid</Eyebrow>
            </h2>
            <span className="font-mono text-xs tabular-nums text-ink-muted">
              {grid.rows.length} {grid.rows.length === 1 ? "skill" : "skills"}
            </span>
          </div>

          {grid.rows.length > 0 ? (
            <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="flex min-w-0 flex-col gap-5">
                <EvidenceGrid
                  columns={GRID_COLUMNS}
                  rows={grid.rows}
                  selfColumn={0}
                  size={gridSize}
                  caption="Your skills by evidence source: self-rating, resume, GitHub and peers"
                />
                <GridLegend />
              </div>

              <dl className="flex flex-col gap-4 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <SourceNote name="Self" swatch={ratedSkillSlugs.length > 0 ? "self" : "empty"}>
                  {ratedSkillSlugs.length > 0
                    ? `${ratedSkillSlugs.length} ${ratedSkillSlugs.length === 1 ? "skill" : "skills"} rated. Shown in amber because it's your own word.`
                    : "Nothing rated yet."}
                </SourceNote>
                <SourceNote name="Resume" swatch={grid.resume && grid.resume.skillCount > 0 ? "evidence" : "empty"}>
                  {grid.resume ? (
                    <>
                      {grid.resume.skillCount} {grid.resume.skillCount === 1 ? "skill" : "skills"} found in{" "}
                      <span className="break-all text-ink">{grid.resume.filename}</span>.
                    </>
                  ) : (
                    <>
                      No resume on file.{" "}
                      <Link href="/profile/resume" className="text-trust underline underline-offset-2">
                        Upload one
                      </Link>
                      .
                    </>
                  )}
                </SourceNote>
                <SourceNote name="GitHub" swatch={grid.github && grid.github.skillCount > 0 ? "evidence" : "empty"}>
                  {grid.github
                    ? grid.github.skillCount > 0
                      ? `${grid.github.skillCount} ${grid.github.skillCount === 1 ? "language" : "languages"} from @${grid.github.username}'s public repos.`
                      : `Connected as @${grid.github.username}. No repo languages match the skill list yet.`
                    : "Not connected yet. Connect it under quick actions."}
                </SourceNote>
                <SourceNote name="Peers" swatch="empty">
                  Coming soon. Teammates will be able to vouch for your skills here.
                </SourceNote>
              </dl>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-6 sm:p-8">
              <EvidenceGrid
                columns={GRID_COLUMNS}
                rows={[{ label: "Your first skill", cells: [0, 0, 0, 0] }]}
                selfColumn={0}
                size="lg"
                animate={false}
                caption="Empty skill grid"
              />
              <div className="max-w-md">
                <p className="font-semibold text-ink">Your grid is empty</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Upload a resume or connect GitHub and the skills we find will fill in here, next to
                  your own ratings.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile/resume" className={`${buttonBase} ${primaryButtonClass}`}>
                  Upload a resume
                </Link>
                {!githubConnected && <ConnectGithubButton returnTo="/dashboard" />}
              </div>
            </div>
          )}
        </section>
      </Reveal>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Evidence connected"
          value={
            <>
              <CountUp to={connectedCount} />
              <span className="text-ink-muted">/{TOTAL_EVIDENCE_SOURCES}</span>
            </>
          }
          hint="Resume and GitHub"
        />
        <StatCard
          label="Skills on file"
          value={<CountUp to={ratedSkillSlugs.length} />}
          hint={
            ratedSkillSlugs.length > 0
              ? ratedSkillSlugs.slice(0, 2).map(skillLabel).join(", ")
              : "None rated yet"
          }
        />
        <StatCard
          label="Interests"
          value={<CountUp to={profile.interestTags.length} />}
          hint={
            profile.interestTags.length > 0
              ? profile.interestTags.slice(0, 2).join(", ")
              : "None selected yet"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ──────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* ── Section tiles ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DASHBOARD_SECTIONS.map((section, index) => (
              <Reveal key={section.href} delay={index * 0.06} className="h-full">
                <NavTile {...section} />
              </Reveal>
            ))}
          </div>

          <SectionCard
            title="Evidence checklist"
            action={
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                {connectedCount}/{TOTAL_EVIDENCE_SOURCES}
              </span>
            }
          >
            <div className="mb-4">
              <ProgressBar fraction={connectedCount / TOTAL_EVIDENCE_SOURCES} />
            </div>
            <ul className="flex flex-col gap-2.5">
              <EvidenceRow done={resumeUploaded}>
                {resumeUploaded ? "Resume uploaded" : "No resume uploaded"}
              </EvidenceRow>
              <EvidenceRow done={githubConnected}>
                {githubConnected ? "GitHub connected" : "GitHub not connected"}
              </EvidenceRow>
              <EvidenceRow done={false} disabled>
                LinkedIn (coming soon)
              </EvidenceRow>
              <EvidenceRow done={false} disabled>
                Peer feedback (coming soon)
              </EvidenceRow>
            </ul>
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
                    <li key={link} className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px] bg-cell-2" />
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-mono text-sm text-ink underline decoration-border-strong underline-offset-4 hover:decoration-trust"
                      >
                        {display}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty message="No project links on file. Editing them after onboarding is coming soon." />
            )}
          </SectionCard>
        </div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              <Link href="/profile" className={linkButton}>
                View full profile
              </Link>
              {githubConnected ? (
                <SecondaryButton type="button" disabled title="GitHub is connected">
                  GitHub connected
                </SecondaryButton>
              ) : (
                <ConnectGithubButton returnTo="/dashboard" className="w-full" />
              )}
              <Link href="/profile/resume" className={linkButton}>
                Manage resumes
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Availability">
            {profile.availability ? (
              <Pill>{AVAILABILITY_LABELS[profile.availability]}</Pill>
            ) : (
              <Empty message="Not set. Editing it after onboarding is coming soon." />
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
