import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_LABELS, COMFORT_LABELS } from "@/lib/onboarding-options";

import { Avatar } from "../Avatar";
import { Empty, EvidenceRow, Pill, SectionCard } from "../ui";

export const metadata: Metadata = {
  title: "SkillGrid – Profile",
};

export default async function ProfilePage() {
  // The (protected) layout already guarantees a signed-in, onboarded user
  // (i.e. a Profile row with onboardingCompletedAt set exists).
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

  const name = session.user?.name ?? session.user?.email ?? "Your profile";
  const email = session.user?.email ?? "";
  const image = session.user?.image ?? null;

  const resumeUploaded = evidence.some((e) => e.source === "RESUME");
  const githubConnected = evidence.some((e) => e.source === "GITHUB");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <Avatar name={name} image={image} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {email && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {email}
            </p>
          )}
          {profile.githubUsername && (
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              GitHub:{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                @{profile.githubUsername}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Bio ────────────────────────────────────────────────── */}
      {profile.bio && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {profile.bio}
        </p>
      )}

      {/* ── Comfort level + availability ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard title="Comfort Level">
          {profile.comfortLevel ? (
            <Pill>{COMFORT_LABELS[profile.comfortLevel]}</Pill>
          ) : (
            <Empty message="Not set" />
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
      <SectionCard title="Evidence">
        <ul className="flex flex-col gap-2">
          {resumeUploaded ? (
            <li className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  ✓
                </span>
                Resume uploaded
              </div>
              <p className="pl-7 text-xs text-neutral-400 dark:text-neutral-600">
                Queued for processing — skills will appear here once extracted.
              </p>
            </li>
          ) : (
            <EvidenceRow done={false}>No resume uploaded</EvidenceRow>
          )}
          <EvidenceRow done={githubConnected}>
            {githubConnected ? "GitHub connected" : "GitHub not connected"}
          </EvidenceRow>
        </ul>
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
                    className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
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
