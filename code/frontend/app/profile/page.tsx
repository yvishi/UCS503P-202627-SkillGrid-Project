import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SkillGrid – Profile",
};

// ---------------------------------------------------------------------------
// Types — mirror the Prisma enums exactly so the swap to real data is trivial.
// ---------------------------------------------------------------------------
type ComfortLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type Availability = "WEEKDAYS" | "WEEKENDS" | "BOTH" | "FLEXIBLE";

type ProfileData = {
  name: string;
  email: string;
  image: string | null;
  githubUsername: string | null;
  bio: string | null;
  // Path B fields — null/empty for users who chose Path A (resume upload).
  comfortLevel: ComfortLevel | null;
  interestTags: string[];
  availability: Availability | null;
  projectLinks: string[];
  // Evidence
  resumeUploaded: boolean;
};

// ---------------------------------------------------------------------------
// Fake data — two variants, one per onboarding path.
// Visit /profile?path=B to see the Path B layout.
// Replace both with a real prisma.profile.findUnique() call once auth is
// wired up and this page moves inside app/(protected)/.
// ---------------------------------------------------------------------------
const FAKE_PATH_A: ProfileData = {
  name: "Alex Johnson",
  email: "alex.johnson@thapar.edu",
  image: null,
  githubUsername: null,
  bio: null,
  // Path B fields are null/empty — this user uploaded a resume instead.
  comfortLevel: null,
  interestTags: [],
  availability: null,
  projectLinks: [],
  resumeUploaded: true,
};

const FAKE_PATH_B: ProfileData = {
  name: "Priya Sharma",
  email: "priya.sharma@thapar.edu",
  image: null,
  githubUsername: "priyasharma",
  bio: "CS sophomore at TIET. Interested in backend systems and cloud infra.",
  comfortLevel: "INTERMEDIATE",
  interestTags: ["Backend", "Cloud", "DevOps", "Web Dev"],
  availability: "WEEKENDS",
  projectLinks: [
    "https://github.com/priyasharma/weather-api",
    "https://github.com/priyasharma/notes-app",
  ],
  resumeUploaded: false,
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
const COMFORT_LABEL: Record<ComfortLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const AVAILABILITY_LABEL: Record<Availability, string> = {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  const user: ProfileData = path === "B" ? FAKE_PATH_B : FAKE_PATH_A;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <Initials name={user.name} />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {user.email}
          </p>
          {user.githubUsername && (
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              GitHub:{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                @{user.githubUsername}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Bio ────────────────────────────────────────────────── */}
      {user.bio && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {user.bio}
        </p>
      )}

      {/* ── Comfort level + availability ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard title="Comfort Level">
          {user.comfortLevel ? (
            <Pill>{COMFORT_LABEL[user.comfortLevel]}</Pill>
          ) : (
            <Empty message="Not set" />
          )}
        </SectionCard>

        <SectionCard title="Availability">
          {user.availability ? (
            <Pill>{AVAILABILITY_LABEL[user.availability]}</Pill>
          ) : (
            <Empty message="Not set" />
          )}
        </SectionCard>
      </div>

      {/* ── Interests ──────────────────────────────────────────── */}
      <SectionCard title="Interests">
        {user.interestTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.interestTags.map((tag) => (
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
          {user.resumeUploaded ? (
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
            <li className="flex items-center gap-2 text-sm text-neutral-400 dark:text-neutral-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] dark:border-neutral-700">
                –
              </span>
              No resume uploaded
            </li>
          )}
          <li className="flex items-center gap-2 text-sm text-neutral-400 dark:text-neutral-600">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] dark:border-neutral-700">
              –
            </span>
            GitHub not connected
          </li>
        </ul>
      </SectionCard>

      {/* ── Project links ──────────────────────────────────────── */}
      <SectionCard title="Projects">
        {user.projectLinks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {user.projectLinks.map((link) => {
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
