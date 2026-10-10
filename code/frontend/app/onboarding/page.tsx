import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/app/ui/ThemeToggle";

import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (profile?.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-graph flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <CellMark />
            <span className="font-display text-lg font-bold tracking-tight">SkillGrid</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted sm:inline">
              Profile setup
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <OnboardingWizard userId={session.user.id} />
      </main>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Trust through evidence, not self-report.
        </p>
      </footer>
    </div>
  );
}

// 2x2 cell mark: three evidence cells (ultramarine scale) and one
// self-reported cell (amber) -- the whole product in four squares.
function CellMark() {
  return (
    <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
      <span className="h-2 w-2 rounded-[2px] bg-trust" />
      <span className="h-2 w-2 rounded-[2px] bg-cell-2" />
      <span className="h-2 w-2 rounded-[2px] bg-cell-3" />
      <span className="h-2 w-2 rounded-[2px] bg-warm" />
    </span>
  );
}
