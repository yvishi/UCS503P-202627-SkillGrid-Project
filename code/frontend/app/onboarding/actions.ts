"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { uploadResume } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import {
  AVAILABILITY_OPTIONS,
  isInterestTag,
  type AvailabilityOption,
} from "@/lib/onboarding-options";
import {
  checkResumeIntegrity,
  extractPdfText,
  extractSkillsFromResumeText,
} from "@/lib/resume-parser";
import { isSkillRatingLevel, isSkillSlug, type SkillRatings, type SkillSlug } from "@/lib/skills";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }
  return userId;
}

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Resume upload step (Path A, spec section 4.1): fast integrity check is
// synchronous and blocking. If it passes, this also runs the keyword-based
// "slow parse" (section 4.1/7) inline -- there's no background job queue in
// this phase, so the two are sequenced in one request rather than one
// blocking and one async, but they remain separate functions/concerns
// (lib/resume-parser.ts) so a real queue can be dropped in later.
// ---------------------------------------------------------------------------
export type ResumeCheckState =
  | { status: "idle" }
  | { status: "error"; reason: string }
  | { status: "ok"; fileUrl: string; extractedSkills: SkillSlug[] };

export async function checkResumeAction(
  _prevState: ResumeCheckState,
  formData: FormData,
): Promise<ResumeCheckState> {
  const userId = await requireUserId();
  const file = formData.get("resume");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", reason: "Please upload a resume to continue." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { status: "error", reason: "Resume must be 5MB or smaller." };
  }
  if (file.type !== "application/pdf") {
    return { status: "error", reason: "Resume must be a PDF file." };
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractPdfText(buffer);
  } catch (err) {
    console.error("extractPdfText failed:", err);
    return {
      status: "error",
      reason: "Couldn't read that PDF. Try a different file, or continue manually instead.",
    };
  }

  const integrity = checkResumeIntegrity(text);
  if (!integrity.passed) {
    return { status: "error", reason: integrity.reason! };
  }

  const extractedSkills = extractSkillsFromResumeText(text);

  let fileUrl: string;
  try {
    fileUrl = await uploadResume(userId, file);
    await prisma.evidenceRecord.create({
      data: {
        userId,
        source: "RESUME",
        payload: { fileUrl, status: "parsed", extractedSkills },
      },
    });
  } catch (err) {
    console.error("checkResumeAction upload/save failed:", err);
    return {
      status: "error",
      reason: "Something went wrong uploading your resume. Please try again.",
    };
  }

  return { status: "ok", fileUrl, extractedSkills };
}

// ---------------------------------------------------------------------------
// Final review & submit (spec sections 4.7 / 5.6): the wizard collects
// everything client-side across steps and sends one payload here, rather
// than threading each step through its own FormData round-trip.
// ---------------------------------------------------------------------------
export type SubmitPayload = {
  skillRatings: SkillRatings;
  interestTags: string[];
  availability: AvailabilityOption | null;
  projectLinks: string[];
  githubUrl: string;
};

export type SubmitState = { error: string } | null;

function isAvailability(value: unknown): value is AvailabilityOption {
  return typeof value === "string" && (AVAILABILITY_OPTIONS as readonly string[]).includes(value);
}

export async function submitOnboardingAction(payload: SubmitPayload): Promise<SubmitState> {
  const userId = await requireUserId();

  const skillRatings: SkillRatings = {};
  for (const [slug, level] of Object.entries(payload.skillRatings)) {
    if (!isSkillSlug(slug) || !level || !isSkillRatingLevel(level)) {
      return { error: "Received an invalid skill rating." };
    }
    skillRatings[slug] = level;
  }
  if (Object.keys(skillRatings).length === 0) {
    return { error: "Please rate at least one skill." };
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

  const githubUrl = payload.githubUrl.trim();
  if (githubUrl) {
    try {
      new URL(githubUrl);
    } catch {
      return { error: `"${githubUrl}" is not a valid GitHub URL.` };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          skillRatings,
          availability: payload.availability!,
          interestTags,
          projectLinks,
          onboardingCompletedAt: new Date(),
        },
        update: {
          skillRatings,
          availability: payload.availability!,
          interestTags,
          projectLinks,
          onboardingCompletedAt: new Date(),
        },
      });

      // Placeholder evidence source (spec section 8): an unverified URL
      // field, not real OAuth, since no GitHub app credentials exist here.
      if (githubUrl) {
        await tx.evidenceRecord.create({
          data: {
            userId,
            source: "GITHUB",
            payload: { url: githubUrl, verified: false },
          },
        });
      }
    });
  } catch (err) {
    console.error("submitOnboardingAction failed:", err);
    return { error: "Something went wrong saving your profile. Please try again." };
  }

  redirect("/dashboard");
}
