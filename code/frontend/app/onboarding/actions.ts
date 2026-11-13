"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AVAILABILITY_OPTIONS,
  isInterestTag,
  type AvailabilityOption,
} from "@/lib/onboarding-options";
import { processResumeUpload } from "@/lib/resume-upload";
import { recomputeUserScoresSafely } from "@/lib/skill-score";
import { countSkillsAndPendingReports } from "@/lib/user-skills";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Resume upload step (Path A, spec section 4.1): fast integrity check is
// synchronous and blocking. If it passes, this also runs the keyword-based
// "slow parse" (section 4.1/7) inline -- there's no background job queue in
// this phase, so the two are sequenced in one request rather than one
// blocking and one async, but they remain separate functions/concerns
// (lib/resume-parser.ts) so a real queue can be dropped in later.
//
// Text extraction tries pdf-parse's text layer first and falls back to
// OCR.space only for scanned/image-only PDFs (see extractResumeText) --
// most uploads never touch the OCR API at all. The upload/validate/parse
// pipeline itself is shared with the post-onboarding re-upload flow (see
// app/(protected)/profile/resume) via lib/resume-upload.ts.
// ---------------------------------------------------------------------------
export type ResumeCheckState =
  | { status: "idle" }
  | { status: "error"; reason: string }
  | { status: "ok"; fileUrl: string; evidenceId: string; extractedSkills: string[]; usedOcr: boolean };

export async function checkResumeAction(
  _prevState: ResumeCheckState,
  formData: FormData,
): Promise<ResumeCheckState> {
  const userId = await requireUserId();
  const file = formData.get("resume");

  if (!(file instanceof File)) {
    return { status: "error", reason: "Please upload a resume to continue." };
  }

  const result = await processResumeUpload(userId, file);
  if (!result.ok) {
    return { status: "error", reason: result.reason };
  }

  let evidenceId: string;
  try {
    const record = await prisma.evidenceRecord.create({
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
    evidenceId = record.id;
  } catch (err) {
    console.error("checkResumeAction save failed:", err);
    return {
      status: "error",
      reason: "Something went wrong uploading your resume. Please try again.",
    };
  }

  return {
    status: "ok",
    fileUrl: result.fileUrl,
    evidenceId,
    extractedSkills: result.extractedSkills,
    usedOcr: result.usedOcr,
  };
}

// ---------------------------------------------------------------------------
// Final review & submit (spec sections 4.7 / 5.6): the wizard collects
// everything client-side across steps and sends one payload here, rather
// than threading each step through its own FormData round-trip.
// ---------------------------------------------------------------------------
export type SubmitPayload = {
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  resumeEvidenceId: string | null;
  githubEvidenceId: string | null;
};

export type SubmitState = { error: string } | null;

function isAvailability(value: unknown): value is AvailabilityOption {
  return typeof value === "string" && (AVAILABILITY_OPTIONS as readonly string[]).includes(value);
}

export async function submitOnboardingAction(payload: SubmitPayload): Promise<SubmitState> {
  const userId = await requireUserId();

  // Skills are saved as they're picked (app/skills/actions.ts), so just
  // confirm the user has at least one -- or one waiting for review.
  const { skills, pendingReports } = await countSkillsAndPendingReports(userId);
  if (skills + pendingReports === 0) {
    return { error: "Please add at least one skill." };
  }

  if (!isAvailability(payload.availability)) {
    return { error: "Please select your availability." };
  }

  const interestTags = payload.interestTags;
  if (interestTags.length === 0) {
    return { error: "Please select at least one interest." };
  }
  for (const tag of interestTags) {
    if (!isInterestTag(tag)) {
      return { error: `Unknown interest tag: ${tag}` };
    }
  }

  const projectLinks = payload.projectLinks.map((link) => link.trim()).filter(Boolean);
  if (projectLinks.length > 3) {
    return { error: "You can add up to 3 project links." };
  }
  for (const link of projectLinks) {
    try {
      new URL(link);
    } catch {
      return { error: `"${link}" is not a valid URL.` };
    }
  }

  // resumeEvidenceId/githubEvidenceId come from client state -- verify
  // they're actually this user's own records before trusting them, the
  // same check selectResumeAction makes
  // (app/(protected)/profile/resume/actions.ts). Detected skills are
  // evidence only; nothing is folded into self-ratings here.
  if (payload.resumeEvidenceId) {
    const record = await prisma.evidenceRecord.findUnique({ where: { id: payload.resumeEvidenceId } });
    if (!record || record.userId !== userId || record.source !== "RESUME") {
      return { error: "Invalid resume selection." };
    }
  }

  if (payload.githubEvidenceId) {
    const record = await prisma.evidenceRecord.findUnique({ where: { id: payload.githubEvidenceId } });
    if (!record || record.userId !== userId || record.source !== "GITHUB") {
      return { error: "Invalid GitHub connection." };
    }
  }

  try {
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        availability: payload.availability!,
        interestTags,
        projectLinks,
        activeResumeId: payload.resumeEvidenceId,
        onboardingCompletedAt: new Date(),
      },
      update: {
        availability: payload.availability!,
        interestTags,
        projectLinks,
        activeResumeId: payload.resumeEvidenceId,
        onboardingCompletedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("submitOnboardingAction failed:", err);
    return { error: "Something went wrong saving your profile. Please try again." };
  }
  await recomputeUserScoresSafely(userId);

  redirect("/dashboard");
}
