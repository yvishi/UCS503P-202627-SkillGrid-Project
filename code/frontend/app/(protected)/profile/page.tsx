import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SkillGrid – Profile",
};

// ---------------------------------------------------------------------------
// Display helpers — labels are keyed off the Prisma enums (see schema.prisma).
// ---------------------------------------------------------------------------
const COMFORT_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const AVAILABILITY_LABEL: Record<string, string> = {
  WEEKDAYS: "Weekdays",
  WEEKENDS: "Weekends",
  BOTH: "Weekdays & Weekends",
  FLEXIBLE: "Flexible",
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-lg font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      {letters.toUpperCase()}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700">
      {children}
    </span>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <p className="text-sm text-neutral-400 dark:text-neutral-600">{message}</p>
  );
}

function EvidenceRow({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li
      className={
        done
          ? "flex items-center gap-2 text-sm"
          : "flex items-center gap-2 text-sm text-neutral-400 dark:text-neutral-600"
      }
    >
      <span
        className={
          done
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white dark:bg-white dark:text-neutral-900"
            : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] dark:border-neutral-700"
        }
      >
        {done ? "✓" : "–"}
      </span>
      {children}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }

  const [profile, evidence] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.evidenceRecord.findMany({
      where: { userId },
      select: { source: true },
    }),
  ]);

  // The protected layout already redirects users without a completed profile
  // to onboarding; this guards the direct-navigation edge case.
  if (!profile?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const name = session.user?.name ?? session.user?.email ?? "Your profile";
  const email = session.user?.email ?? "";
  const image = session.user?.image ?? null;

  const resumeUploaded = evidence.some((e) => e.source === "RESUME");
  const githubConnected = evidence.some((e) => e.source === "GITHUB");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="h-16 w-16 rounded-full" />
        ) : (
          <Initials name={name} />
        )}
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
            <Pill>{COMFORT_LABEL[profile.comfortLevel] ?? profile.comfortLevel}</Pill>
          ) : (
            <Empty message="Not set" />
          )}
        </SectionCard>

        <SectionCard title="Availability">
          {profile.availability ? (
            <Pill>
              {AVAILABILITY_LABEL[profile.availability] ?? profile.availability}
            </Pill>
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
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white dark:bg-white dark:text-neutral-900">
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
