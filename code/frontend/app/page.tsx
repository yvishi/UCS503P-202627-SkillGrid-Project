import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow, GoogleIcon, PrimaryButton, SecondaryButton, TrustBadge } from "@/app/ui/primitives";
import { ThemeToggle } from "@/app/ui/ThemeToggle";

const FEATURES = [
  {
    accent: "trust",
    title: "Evidence, not self-report",
    description:
      "No more \"proficient in React.\" Every skill tag on your profile traces back to a resume, a repo, or peer feedback.",
  },
  {
    accent: "warm",
    title: "Automatic resume parsing",
    description:
      "Upload your resume once. We extract your skills so you don't have to fill out another form.",
  },
  {
    accent: "success",
    title: "GitHub, connected",
    description:
      "Link your GitHub to surface real languages, commits, and contributions — not a checkbox you ticked.",
  },
  {
    accent: "gold",
    title: "Matching that makes sense",
    description:
      "Find teammates by comfort level, availability, and interests instead of guessing from a resume.",
  },
] as const;

const INTAKE_STEPS = [
  { title: "Sign in", description: "Use your college Google account — no new password to remember." },
  { title: "Build your profile", description: "Upload a resume or set your interests and availability by hand." },
  { title: "Get matched", description: "Surface teammates and projects that fit how you actually work." },
];

function SignInButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
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
        Sign in with college Google account
      </Button>
    </form>
  );
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

  return (
    <div className="flex flex-1 flex-col bg-bg">
      {/* ── Nav ────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-extrabold tracking-tight text-trust">SkillGrid</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignInButton variant="secondary" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-7 px-6 py-24 text-center">
          <Eyebrow>Built for Thapar students</Eyebrow>
          <h1 className="font-display max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Trust through evidence,
            <br /> not self-report.
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-muted">
            SkillGrid builds your skill profile from what you&apos;ve actually
            done — resumes, GitHub activity, and peer feedback — so teammates
            and recruiters don&apos;t have to take your word for it.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <TrustBadge>Resume verified</TrustBadge>
            <TrustBadge>GitHub linked</TrustBadge>
            <TrustBadge>Peer reviewed</TrustBadge>
          </div>

          {error === "AccessDenied" && (
            <p className="max-w-sm rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
              Sign-in is restricted to college email accounts. Please use your
              college Google account.
            </p>
          )}

          <SignInButton />
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-6 py-16 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
              style={{ borderTop: `4px solid var(--${feature.accent})` }}
            >
              <h3 className="font-display font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="bg-surface-alt px-6 py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
            <h2 className="font-display text-center text-2xl font-bold tracking-tight">
              How it works
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {INTAKE_STEPS.map((s, index) => (
                <div key={s.title} className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
                  <div className="font-display mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-trust text-sm font-bold text-surface">
                    {index + 1}
                  </div>
                  <h3 className="font-display font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-ink-muted">
        SkillGrid — restricted to college Google accounts.
      </footer>
    </div>
  );
}
