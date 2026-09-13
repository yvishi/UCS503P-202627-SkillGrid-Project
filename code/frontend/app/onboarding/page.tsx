import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <OnboardingWizard userId={session.user.id} />
    </main>
  );
}
