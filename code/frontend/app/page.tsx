import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow, GoogleIcon, Pill, PrimaryButton, SecondaryButton } from "@/app/ui/primitives";
import { ThemeToggle } from "@/app/ui/ThemeToggle";
import { BlurText, Reveal } from "@/app/ui/motion";
import { EvidenceGrid, GridLegend, type GridRow } from "@/app/ui/EvidenceGrid";
import { cellColor, type CellLevel } from "@/app/ui/cell-color";
import { GraphBackdrop } from "@/app/landing/GraphBackdrop";

// ── Sample student for the hero grid ──────────────────────────────────
// Columns are the evidence sources; column 0 (Self) is drawn amber.
// The top rows have a resume line and repos behind them; the bottom rows
// are only claims. That contrast is the pitch.
const COLUMNS = ["Self", "Resume", "GitHub", "Peers"];

const SAMPLE: GridRow[] = [
  { label: "React", cells: [3, 3, 4, 0] },
  { label: "TypeScript", cells: [2, 2, 3, 0] },
  { label: "Python", cells: [3, 2, 2, 0] },
  { label: "SQL", cells: [2, 2, 0, 0] },
  { label: "Docker", cells: [3, 0, 0, 0] },
  { label: "Kubernetes", cells: [2, 0, 0, 0] },
  { label: "Figma", cells: [3, 0, 0, 0] },
];

const SAMPLE_ROWS: GridRow[] = SAMPLE;
const BACKED = SAMPLE.filter((s) => s.cells.slice(1).some((l) => l > 0)).length;
const CLAIMED_ONLY = SAMPLE_ROWS.filter((r) => r.cells.slice(1).every((l) => l === 0)).map((r) => r.label);

// ── What each column means ────────────────────────────────────────────
const SOURCES = [
  {
    column: "Self",
    tone: "warm",
    title: "What you say",
    body: "Your own rating for each skill: just starting, comfortable or confident. It's a fair place to start, so it stays on the grid, but it's drawn in amber so nobody mistakes it for proof.",
    sample: [1, 2, 3, 4] as CellLevel[],
  },
  {
    column: "Resume",
    tone: "trust",
    title: "What you've written down",
    body: "Upload your resume as a PDF and we match it against a catalog of hundreds of languages, frameworks and tools. Skills it names fill this column.",
    sample: [0, 2, 3, 2] as CellLevel[],
  },
  {
    column: "GitHub",
    tone: "trust",
    title: "What you've shipped",
    body: "Connect your GitHub account and the languages across your repositories count here. Code you actually pushed is harder to overstate than a line on a form.",
    sample: [4, 3, 0, 1] as CellLevel[],
  },
  {
    column: "Peers",
    tone: "pending",
    title: "What teammates saw",
    body: "After a hackathon or project, the people you worked with will be able to confirm what you did. This column isn't live yet, so it stays empty for everyone.",
    sample: [0, 0, 0, 0] as CellLevel[],
  },
] as const;

// ── How it works (a real sequence, so numbering is earned) ────────────
const STEPS = [
  {
    title: "Sign in with your college account",
    body: "Google sign-in, limited to Thapar accounts. No new password, and everyone you meet here is a fellow student.",
  },
  {
    title: "Build your profile",
    body: "Upload your resume and we pre-fill your skills, or rate them by hand. Add your interests and when you're free. Connect GitHub whenever you like.",
  },
  {
    title: "Find people to build with",
    body: "Look for students with the skills your team is missing, see what backs each one, and team up for the next hackathon or project.",
  },
];

function SignInButton({
  variant = "primary",
  label = "Sign in with your college Google account",
}: {
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const Button = variant === "primary" ? PrimaryButton : SecondaryButton;
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button type="submit">
        <GoogleIcon />
        {label}
      </Button>
    </form>
  );
}

// 2×2 cell mark: three evidence levels and one amber self-report cell,
// the whole idea in four squares.
function Mark() {
  return (
    <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
      <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-4" />
      <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-2" />
      <span className="h-[7px] w-[7px] rounded-[1.5px] bg-warm" />
      <span className="h-[7px] w-[7px] rounded-[1.5px] bg-cell-3" />
    </span>
  );
}

function SourceCell({ level, tone }: { level: CellLevel; tone: "warm" | "trust" | "pending" }) {
  if (tone === "pending") {
    return <span className="block h-5 w-5 rounded-[4px] border border-dashed border-border-strong" />;
  }
  const backgroundColor = cellColor(level, tone === "warm");
  return <span className="block h-5 w-5 rounded-[4px]" style={{ backgroundColor }} />;
}

export default async function LandingPage({
  searchParams,
}: PageProps<"/">) {
  const session = await auth();
  const { error } = await searchParams;

  if (session?.user?.id) {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });
    redirect(profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
  }

  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <span className="flex items-center gap-2">
            <Mark />
            <span className="text-[17px] font-bold tracking-tight text-ink">SkillGrid</span>
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <SignInButton variant="secondary" label="Sign in" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero: the thesis on the left, the proof on the right */}
        <section className="bg-graph relative overflow-hidden border-b border-border">
          <GraphBackdrop />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:gap-16 lg:py-24">
            <div className="flex max-w-2xl flex-col items-start gap-6">
              <Eyebrow>Trust through evidence, not self-report</Eyebrow>
              <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight text-balance text-ink sm:text-6xl">
                <BlurText text="Skills you can point to, not just skills you list." />
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-ink-muted sm:text-base">
                SkillGrid builds your profile from your resume and your GitHub,
                and keeps what you&apos;ve only claimed visibly separate. When
                you look for hackathon teammates, everyone can see which skills
                have something behind them.
              </p>

              {error === "AccessDenied" && (
                <div
                  role="alert"
                  className="w-full max-w-md rounded-theme-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm leading-relaxed text-ink"
                >
                  <p className="font-semibold text-danger">That account can&apos;t sign in here.</p>
                  <p className="mt-1 text-ink-muted">
                    SkillGrid only accepts college Google accounts
                    {allowedDomain ? (
                      <>
                        {" "}ending in <span className="font-mono text-ink">@{allowedDomain}</span>
                      </>
                    ) : null}
                    . Sign in again and pick your college account in Google&apos;s
                    account chooser, or add it there if it isn&apos;t listed.
                  </p>
                </div>
              )}

              <SignInButton />
              <p className="-mt-3 text-xs text-ink-muted">Thapar Google accounts only. Takes about a minute.</p>
            </div>

            <figure className="w-full max-w-md justify-self-center rounded-theme-lg border border-border bg-surface p-5 shadow-[0_1px_0_var(--border)] sm:p-6 lg:justify-self-end">
              <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
                <Eyebrow>Sample profile</Eyebrow>
                <span className="font-mono text-[11px] text-ink-muted">
                  {BACKED}/{SAMPLE.length} backed
                </span>
              </div>
              <EvidenceGrid
                columns={COLUMNS}
                rows={SAMPLE_ROWS}
                size="lg"
                selfColumn={0}
                caption="Sample student's skills by evidence source"
              />
              <GridLegend className="mt-5" />
              <figcaption className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-ink-muted">
                React has a resume line and a few repos behind it.{" "}
                {CLAIMED_ONLY.join(", ").replace(/, ([^,]*)$/, " and $1")} are claims so far,
                and the grid says so.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* What each column means */}
        <section aria-labelledby="columns-heading" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <Eyebrow>The columns</Eyebrow>
              <h2 id="columns-heading" className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                What counts as evidence
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                Each row on your grid is a skill. Each column is a different
                source asked to vouch for it, and a cell only fills in when that
                source has something to show.
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-theme-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                {SOURCES.map((src) => (
                  <article key={src.column} className="flex flex-col bg-surface">
                    <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-alt/60 px-5 py-2.5">
                      <h3
                        className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${
                          src.tone === "warm" ? "text-warm-strong" : src.tone === "trust" ? "text-trust-strong" : "text-ink-muted"
                        }`}
                      >
                        {src.column}
                      </h3>
                      {src.tone === "pending" && <Pill>Coming soon</Pill>}
                    </header>
                    <div className="flex flex-1 gap-5 p-5">
                      <div aria-hidden="true" className="flex flex-col gap-1.5 pt-0.5">
                        {src.sample.map((level, j) => (
                          <SourceCell key={j} level={level} tone={src.tone} />
                        ))}
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{src.title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{src.body}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="steps-heading" className="border-t border-border bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="steps-heading" className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                From sign-in to a team in three steps
              </h2>
            </Reveal>

            <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 0.08} className="flex h-full flex-col">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-medium text-ink">
                        {i + 1}
                        <span className="text-ink-muted">/{STEPS.length}</span>
                      </span>
                      <span aria-hidden="true" className="flex flex-1 gap-[3px]">
                        {STEPS.map((_, j) => (
                          <span
                            key={j}
                            className={`h-2 flex-1 rounded-[2px] ${j <= i ? "bg-trust" : "bg-cell-0"}`}
                          />
                        ))}
                      </span>
                    </div>
                    <h3 className="mt-5 font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-col items-start gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">Your grid starts empty. One resume upload fills in a whole column.</p>
              <SignInButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl font-mono text-[11px] text-ink-muted">
          SkillGrid · built by students at Thapar Institute · sign-in limited to college Google accounts
        </p>
      </footer>
    </div>
  );
}
