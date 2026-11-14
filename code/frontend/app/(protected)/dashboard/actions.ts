"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { endGuide, markGuideStepSeen } from "@/lib/guide";
import { ACK_STEPS, type GuideStepId } from "@/lib/guide-core";

// Server actions for the dashboard's getting-started guide. The actor is
// always the session user; the form only names a step.

async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** "Hide guide": ends the guide for good. */
export async function hideGuideAction(): Promise<void> {
  const userId = await sessionUserId();
  if (!userId) return;
  await endGuide(userId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Marks an acknowledgeable step as seen. The invites step then opens /invites. */
export async function ackGuideStepAction(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  const step = formData.get("step");
  if (!userId || typeof step !== "string") return;
  if (!ACK_STEPS.includes(step as GuideStepId)) return;
  await markGuideStepSeen(userId, step as GuideStepId);
  revalidatePath("/dashboard");
  if (step === "invites") redirect("/invites");
}
