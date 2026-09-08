import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

const FEATURES = [
  {
    title: "Evidence, not self-report",
    description:
      "No more \"proficient in React.\" Every skill tag on your profile traces back to a resume, a repo, or peer feedback.",
  },
  {
    title: "Automatic resume parsing",
    description:
      "Upload your resume once. We extract your skills so you don't have to fill out another form.",
  },
  {
    title: "GitHub, connected",
    description:
      "Link your GitHub to surface real languages, commits, and contributions — not a checkbox you ticked.",
  },
  {
    title: "Matching that makes sense",
    description:
      "Find teammates by comfort level, availability, and interests instead of guessing from a resume.",
  },
];

const STEPS = [
  { step: "1", title: "Sign in", description: "Use your college Google account — no new password to remember." },
  { step: "2", title: "Build your profile", description: "Upload a resume or set your interests and availability by hand." },
  { step: "3", title: "Get matched", description: "Surface teammates and projects that fit how you actually work." },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.89c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

function SignInButton({ className }: { className: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button type="submit" className={className}>
        <GoogleIcon />
        Sign in with college Google account
      </button>
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
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">SkillGrid</span>
          <SignInButton className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800" />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-6 px-6 py-24 text-center">
          <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            Built for Thapar students
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Trust through evidence,
            <br /> not self-report.
          </h1>
          <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            SkillGrid builds your skill profile from what you&apos;ve actually
            done — resumes, GitHub activity, and peer feedback — so teammates
            and recruiters don&apos;t have to take your word for it.
          </p>

          {error === "AccessDenied" && (
            <p className="max-w-sm rounded-md bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              Sign-in is restricted to college email accounts. Please use your
              college Google account.
            </p>
          )}

          <SignInButton className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800" />
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <h3 className="font-medium">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section className="border-t border-neutral-200 px-6 py-20 dark:border-neutral-800">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.step} className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {s.step}
                  </span>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
        SkillGrid — restricted to college Google accounts.
      </footer>
    </div>
  );
}
