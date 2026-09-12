"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processResumeUpload } from "@/lib/resume-upload";
import { isSkillSlug, mergeSkillRatings, parseSkillRatings, type SkillSlug } from "@/lib/skills";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not signed in");
  }
  return userId;
}

export type ReuploadState = { error: string } | null;

// Uploads a new resume, adds it to the user's evidence history, makes it
// the active one, and merges its extracted skills into the profile --
// same reconciliation rule as onboarding review (new skills default to
// "Comfortable", existing ratings aren't overwritten).
export async function reuploadResumeAction(
  _prevState: ReuploadState,
  formData: FormData,
): Promise<ReuploadState> {
  const userId = await requireUserId();
  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return { error: "Please choose a resume to upload." };
  }

  const result = await processResumeUpload(userId, file);
  if (!result.ok) {
    return { error: result.reason };
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const merged = mergeSkillRatings(parseSkillRatings(profile?.skillRatings), result.extractedSkills);

    await prisma.$transaction(async (tx) => {
      const record = await tx.evidenceRecord.create({
        data: {
          userId,
          source: "RESUME",
          payload: {
            fileUrl: result.fileUrl,
            filename: result.filename,
            status: "parsed",
            extractedSkills: result.extractedSkills,
            usedOcr: result.usedOcr,
          },
        },
      });
      await tx.profile.update({
        where: { userId },
        data: { activeResumeId: record.id, skillRatings: merged },
      });
    });
  } catch (err) {
    console.error("reuploadResumeAction save failed:", err);
    return { error: "Something went wrong saving your resume. Please try again." };
  }

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return null;
}

// Switches back to a previously-uploaded resume without re-uploading it,
// and re-applies its extracted skills the same way a fresh upload would.
export async function selectResumeAction(evidenceId: string): Promise<ReuploadState> {
  const userId = await requireUserId();

  const record = await prisma.evidenceRecord.findUnique({ where: { id: evidenceId } });
  if (!record || record.userId !== userId || record.source !== "RESUME") {
    return { error: "That resume could not be found." };
  }

  const payload = record.payload as { extractedSkills?: string[] };
  const extractedSkills = (payload.extractedSkills ?? []).filter(
    (s): s is SkillSlug => typeof s === "string" && isSkillSlug(s),
  );

  try {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const merged = mergeSkillRatings(parseSkillRatings(profile?.skillRatings), extractedSkills);
    await prisma.profile.update({
      where: { userId },
      data: { activeResumeId: evidenceId, skillRatings: merged },
    });
  } catch (err) {
    console.error("selectResumeAction failed:", err);
    return { error: "Something went wrong switching resumes. Please try again." };
  }

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return null;
}
