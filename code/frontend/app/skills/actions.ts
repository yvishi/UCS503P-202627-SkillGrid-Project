"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getEvidenceSnapshot } from "@/lib/evidence";
import type { ReportInput, ReportResult } from "@/lib/skill-report-input";
import { cancelReport, reportSkill } from "@/lib/skill-requests";
import type { EvidenceSnapshot } from "@/lib/skill-suggestions";
import { isSkillRatingLevel, type UserSkillEntry } from "@/lib/skills";
import { addUserSkill, removeUserSkill, setUserSkillLevel } from "@/lib/user-skills";

// Server actions behind the SkillPicker (app/ui/skill-picker), shared by
// onboarding and /profile/skills -- both save as the user goes.

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");
  return userId;
}

function revalidateSkillPages() {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export type SkillActionResult = { ok: true; skill: UserSkillEntry } | { ok: false; error: string };

export async function addUserSkillAction(slug: string, level: string): Promise<SkillActionResult> {
  const userId = await requireUserId();
  if (!isSkillRatingLevel(level)) return { ok: false, error: "Invalid comfort level." };
  try {
    const skill = await addUserSkill(userId, slug, level);
    if (!skill) return { ok: false, error: "That skill isn't in the catalog." };
    revalidateSkillPages();
    return { ok: true, skill };
  } catch (err) {
    console.error("addUserSkillAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function setUserSkillLevelAction(slug: string, level: string): Promise<SkillActionResult> {
  const userId = await requireUserId();
  if (!isSkillRatingLevel(level)) return { ok: false, error: "Invalid comfort level." };
  try {
    const skill = await setUserSkillLevel(userId, slug, level);
    if (!skill) return { ok: false, error: "You haven't added that skill." };
    revalidateSkillPages();
    return { ok: true, skill };
  } catch (err) {
    console.error("setUserSkillLevelAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function removeUserSkillAction(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    await removeUserSkill(userId, slug);
    revalidateSkillPages();
    return { ok: true };
  } catch (err) {
    console.error("removeUserSkillAction failed:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function reportSkillAction(input: ReportInput): Promise<ReportResult> {
  const userId = await requireUserId();
  try {
    const result = await reportSkill(userId, input);
    if (result.status !== "error") revalidateSkillPages();
    return result;
  } catch (err) {
    console.error("reportSkillAction failed:", err);
    return { status: "error", error: GENERIC_ERROR };
  }
}

export async function cancelReportAction(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  try {
    const ok = await cancelReport(userId, id);
    if (ok) revalidateSkillPages();
    return { ok };
  } catch (err) {
    console.error("cancelReportAction failed:", err);
    return { ok: false };
  }
}

// Onboarding asks for this after a resume upload or GitHub connect, so its
// suggestions reflect evidence gathered mid-wizard. The resume id comes
// from the client; findActiveResumePayload scopes it to this user.
export async function getEvidenceSnapshotAction(resumeEvidenceId: string | null): Promise<EvidenceSnapshot> {
  const userId = await requireUserId();
  return getEvidenceSnapshot(userId, resumeEvidenceId);
}
