import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow, GoogleIcon, PrimaryButton, SecondaryButton, Stamp } from "@/app/ui/primitives";

const FILE_ENTRIES = [
  {
    tag: "RESUME",
    title: "Evidence, not self-report",
    description:
      "No more \"proficient in React.\" Every skill tag on your profile traces back to a resume, a repo, or peer feedback.",
  },
  {
    tag: "PARSE",
    title: "Automatic resume parsing",
    description:
      "Upload your resume once. We extract your skills so you don't have to fill out another form.",
  },
  {
    tag: "GITHUB",
    title: "GitHub, connected",
    description:
      "Link your GitHub to surface real languages, commits, and contributions — not a checkbox you ticked.",
  },
  {
    tag: "MATCH",
    title: "Matching that makes sense",
    description:
      "Find teammates by comfort level, availability, and interests instead of guessing from a resume.",
  },
];

const INTAKE_STEPS = [
  { field: "IDENTITY", title: "Sign in", description: "Use your college Google account — no new password to remember." },
  { field: "DOSSIER", title: "Build your profile", description: "Upload a resume or set your interests and availability by hand." },
  { field: "OUTCOME", title: "Get matched", description: "Surface teammates and projects that fit how you actually work." },
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
    <div className="flex flex-1 flex-col">
      {/* ── Nav ────────────────────────────────────────────────── */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-sm font-bold tracking-tight">SkillGrid</span>
          <SignInButton variant="secondary" />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="grid-paper flex flex-col items-center gap-7 border-b border-line px-6 py-24 text-center">
          <Eyebrow>Built for Thapar students</Eyebrow>
          <h1 className="font-display max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Trust through evidence,
            <br /> not self-report.
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-muted">
            SkillGrid builds your skill profile from what you&apos;ve actually
            done — resumes, GitHub activity, and peer feedback — so teammates
            and recruiters don&apos;t have to take your word for it.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Stamp>Resume verified</Stamp>
            <Stamp pending>GitHub pending</Stamp>
            <Stamp>Peer reviewed</Stamp>
          </div>

          {error === "AccessDenied" && (
            <p className="max-w-sm border border-stamp/40 bg-stamp/5 px-4 py-2 text-center text-sm text-stamp">
              Sign-in is restricted to college email accounts. Please use your
              college Google account.
            </p>
          )}

          <SignInButton />
        </section>

        {/* ── Features, framed as case-file entries ────────────────── */}
        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 py-20 sm:grid-cols-2">
          {FILE_ENTRIES.map((entry) => (
            <div key={entry.title} className="flex gap-4 border border-line bg-paper-raised p-5">
              <span className="font-display shrink-0 text-xs font-semibold tracking-[0.1em] text-ink-muted">
                {entry.tag}
              </span>
              <div>
                <h3 className="font-display font-semibold">{entry.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {entry.description}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* ── How it works, as an intake form ──────────────────────── */}
        <section className="border-t border-line px-6 py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
            <h2 className="font-display text-center text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <div className="grid grid-cols-1 divide-y divide-line border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {INTAKE_STEPS.map((s) => (
                <div key={s.field} className="flex flex-col gap-2 p-6">
                  <Eyebrow>{s.field}</Eyebrow>
                  <h3 className="font-display font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-6 py-6 text-center text-xs text-ink-muted">
        SkillGrid — restricted to college Google accounts.
      </footer>
    </div>
  );
}
