import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { NavBar } from "./NavBar";

// Everything under this route group requires a signed-in, onboarded user.
// Pages inside it can trust that invariant rather than re-checking it.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
