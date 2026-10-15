import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEvidenceStatus } from "@/lib/evidence";
import { AVAILABILITY_LABELS } from "@/lib/onboarding-options";

import { Avatar } from "@/app/ui/Avatar";
import { ConnectGithubButton, GithubConnectionBanner } from "@/app/ui/ConnectGithubButton";
import { EvidenceGrid, GridLegend } from "@/app/ui/EvidenceGrid";
import { Reveal } from "@/app/ui/motion";
import { Empty, Eyebrow, Pill, SectionCard, TrustBadge, buttonBase, secondaryButtonClass } from "@/app/ui/primitives";

import { buildSkillGrid, githubSkillsFromPayload } from "@/lib/skill-grid";

export const metadata: Metadata = {
  title: "SkillGrid – Profile",
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

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

  const [profileOrNull, { resumeUploaded, githubConnected }, githubRecord] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    getEvidenceStatus(userId),
    prisma.evidenceRecord.findFirst({
      where: { userId, source: "GITHUB" },
      select: { payload: true },
    }),
  ]);
  const profile = profileOrNull!;

  // The resume column reads the active resume, falling back to the latest
  // upload (e.g. records from before activeResumeId existed).
  const resumeRecord =
    (profile.activeResumeId
      ? await prisma.evidenceRecord.findFirst({
          where: { id: profile.activeResumeId, userId, source: "RESUME" },
          select: { payload: true, createdAt: true },
        })
      : null) ??
    (resumeUploaded
      ? await prisma.evidenceRecord.findFirst({
          where: { userId, source: "RESUME" },
          orderBy: { createdAt: "desc" },
          select: { payload: true, createdAt: true },
        })
      : null);

  const grid = buildSkillGrid({
    skillRatings: profile.skillRatings,
    resumePayload: resumeRecord?.payload,
    githubPayload: githubRecord?.payload,
  });

  const name = session.user?.name ?? session.user?.email ?? "Your profile";
  const email = session.user?.email ?? "";
  const image = session.user?.image ?? null;

  const resumeFilename = (resumeRecord?.payload as { filename?: string } | undefined)?.filename ?? "resume.pdf";
  const githubPayload = githubRecord?.payload as { repoCount?: number } | undefined;
  const githubSkillCount = githubSkillsFromPayload(githubRecord?.payload).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <GithubConnectionBanner status={githubStatus} />

      {/* ── Identity ───────────────────────────────────────────── */}
      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <Avatar name={name} image={image} size="h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl" />
          <div className="min-w-0">
            <Eyebrow>Evidence record</Eyebrow>
            <h1 className="font-display mt-1 truncate text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-ink-muted">
              {email && <span className="truncate">{email}</span>}
              {profile.githubUsername && (
                <a
                  href={`https://github.com/${encodeURIComponent(profile.githubUsername)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-theme-sm text-ink hover:text-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust"
                >
                  github.com/{profile.githubUsername}
                </a>
              )}
            </p>
          </div>
        </div>
        <ul aria-label="Evidence on file" className="flex flex-wrap gap-2 sm:justify-end">
          <li>
            <TrustBadge pending={!resumeUploaded}>{resumeUploaded ? "Resume on file" : "No resume"}</TrustBadge>
          </li>
          <li>
            <TrustBadge pending={!githubConnected}>{githubConnected ? "GitHub linked" : "GitHub not linked"}</TrustBadge>
          </li>
          <li>
            <TrustBadge pending>Peer review soon</TrustBadge>
          </li>
        </ul>
      </header>

      {/* ── Skill evidence grid ────────────────────────────────── */}
      <Reveal>
        <section aria-labelledby="skills-heading" className="rounded-theme-lg border border-border bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 id="skills-heading">
              <Eyebrow>Skills × evidence</Eyebrow>
            </h2>
            {grid.rows.length > 0 && (
              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {grid.backedCount} of {grid.rows.length} backed by evidence
              </span>
            )}
          </div>
          <div className="bg-graph p-5 sm:p-6">
            {grid.rows.length > 0 ? (
              <EvidenceGrid
                columns={grid.columns}
                rows={grid.rows}
                selfColumn={grid.selfColumn}
                size="lg"
                caption="Your skills against each evidence source: self-rating, resume, GitHub and peers"
              />
            ) : (
              <Empty message="No skills yet. Upload a resume or connect GitHub and they'll appear here." />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <GridLegend />
            <p className="text-xs text-ink-muted">Peer feedback is coming soon.</p>
          </div>
        </section>
      </Reveal>

      {/* ── Details ledger ─────────────────────────────────────── */}
      <section aria-labelledby="details-heading" className="rounded-theme-lg border border-border bg-surface">
        <h2 id="details-heading" className="border-b border-border px-5 py-3">
          <Eyebrow>Details</Eyebrow>
        </h2>
        <dl className="divide-y divide-border">
          {profile.bio && (
            <LedgerRow label="Bio">
              <p className="max-w-prose text-sm leading-relaxed">{profile.bio}</p>
            </LedgerRow>
          )}
          <LedgerRow label="Availability">
            {profile.availability ? (
              <span className="text-sm">{AVAILABILITY_LABELS[profile.availability]}</span>
            ) : (
              <Empty message="Not set" />
            )}
          </LedgerRow>
          <LedgerRow label="Interests">
            {profile.interestTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.interestTags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
            ) : (
              <Empty message="No interests selected" />
            )}
          </LedgerRow>
          <LedgerRow label="Projects">
            {profile.projectLinks.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {profile.projectLinks.map((link) => {
                  let display = link;
                  try {
                    const url = new URL(link);
                    display = url.hostname + url.pathname;
                  } catch {
                    // leave as-is if URL parsing fails
                  }
                  return (
                    <li key={link} className="min-w-0">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate rounded-theme-sm font-mono text-xs text-trust underline decoration-border-strong underline-offset-4 hover:decoration-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust"
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
          </LedgerRow>
        </dl>
      </section>

      {/* ── Evidence sources ───────────────────────────────────── */}
      <SectionCard title="Evidence sources">
        <ul className="-my-3 divide-y divide-border">
          <SourceRow
            done={resumeUploaded}
            name="Resume"
            detail={
              resumeRecord ? (
                <span className="font-mono">
                  <span className="text-ink">{resumeFilename}</span> · uploaded{" "}
                  {resumeRecord.createdAt.toLocaleDateString("en-GB", DATE_FORMAT)}
                </span>
              ) : (
                "Upload a PDF resume and the skills it names are added as evidence."
              )
            }
            action={
              <Link
                href="/profile/resume"
                className={`${buttonBase} ${secondaryButtonClass} px-3 py-1.5 text-xs`}
              >
                {resumeUploaded ? "Manage resumes" : "Upload a resume"}
              </Link>
            }
          />
          <SourceRow
            done={githubConnected}
            name="GitHub"
            detail={
              githubConnected ? (
                <span className="font-mono">
                  {profile.githubUsername && <span className="text-ink">@{profile.githubUsername}</span>}
                  {typeof githubPayload?.repoCount === "number" &&
                    ` · ${githubPayload.repoCount} ${githubPayload.repoCount === 1 ? "repo" : "repos"} scanned`}
                  {` · ${githubSkillCount} ${githubSkillCount === 1 ? "skill" : "skills"} matched`}
                </span>
              ) : (
                "Connect GitHub and the languages in your own repositories count as evidence."
              )
            }
            action={
              githubConnected ? undefined : (
                <ConnectGithubButton returnTo="/profile" variant="primary" className="px-3 py-1.5 text-xs" />
              )
            }
          />
          <SourceRow
            done={false}
            disabled
            name="Peers"
            detail="Teammates will be able to vouch for your skills after working with you. Coming soon."
          />
        </ul>
      </SectionCard>
    </main>
  );
}

function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 px-5 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="pt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function SourceRow({
  done,
  disabled = false,
  name,
  detail,
  action,
}: {
  done: boolean;
  disabled?: boolean;
  name: string;
  detail: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-1 h-3 w-3 shrink-0 rounded-[3px] ${
            done ? "bg-trust" : disabled ? "border border-dashed border-border-strong" : "border border-border-strong"
          }`}
        />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${disabled ? "text-ink-muted" : "text-ink"}`}>
            {name}
            <span className="sr-only">{done ? " (on file)" : disabled ? " (coming soon)" : " (not on file)"}</span>
          </p>
          <p className="mt-0.5 break-words text-xs text-ink-muted">{detail}</p>
        </div>
      </div>
      {action && <div className="shrink-0 pl-6 sm:pl-0">{action}</div>}
    </li>
  );
}
