"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processResumeUpload } from "@/lib/resume-upload";
import { recomputeUserScoresSafely } from "@/lib/skill-score";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not signed in");
  }
  return userId;
}

export type ReuploadState = { error: string } | null;

// Uploads a new resume, adds it to the user's evidence history and makes
// it the active one. Its extracted skills are evidence (the grid's Resume
// column) and picker suggestions -- they no longer touch self-ratings.
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
        data: { activeResumeId: record.id },
      });
    });
  } catch (err) {
    console.error("reuploadResumeAction save failed:", err);
    return { error: "Something went wrong saving your resume. Please try again." };
  }
  await recomputeUserScoresSafely(userId);

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
  return null;
}

// Switches back to a previously-uploaded resume without re-uploading it.
export async function selectResumeAction(evidenceId: string): Promise<ReuploadState> {
  const userId = await requireUserId();

  const record = await prisma.evidenceRecord.findUnique({ where: { id: evidenceId } });
  if (!record || record.userId !== userId || record.source !== "RESUME") {
    return { error: "That resume could not be found." };
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: { activeResumeId: evidenceId },
    });
  } catch (err) {
    console.error("selectResumeAction failed:", err);
    return { error: "Something went wrong switching resumes. Please try again." };
  }
  await recomputeUserScoresSafely(userId);

  revalidatePath("/profile/resume");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/profile/skills");
  return null;
}
