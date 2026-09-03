import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (profile?.onboardingCompletedAt) {
    redirect("/");
  }

  return <OnboardingForm />;
}
