"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { uploadResume } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import {
  AVAILABILITY_OPTIONS,
  COMFORT_LEVELS,
  isInterestTag,
  type AvailabilityOption,
  type ComfortLevelOption,
} from "@/lib/onboarding-options";

export type OnboardingActionState = { error: string } | null;

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }
  return userId;
}

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function completeOnboardingPathA(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const userId = await requireUserId();
  const file = formData.get("resume");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please upload a resume to continue." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: "Resume must be 5MB or smaller." };
  }
  if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
    return { error: "Resume must be a PDF or DOCX file." };
  }

  let fileUrl: string;
  try {
    fileUrl = await uploadResume(userId, file);

    await prisma.$transaction([
      prisma.evidenceRecord.create({
        data: {
          userId,
          source: "RESUME",
          payload: { fileUrl, status: "pending_parse" },
        },
      }),
      prisma.profile.upsert({
        where: { userId },
        create: { userId, onboardingCompletedAt: new Date() },
        update: { onboardingCompletedAt: new Date() },
      }),
    ]);
  } catch (err) {
    console.error("completeOnboardingPathA failed:", err);
    return {
      error: "Something went wrong uploading your resume. Please try again.",
    };
  }

  redirect("/");
}

function isComfortLevel(value: FormDataEntryValue | null): value is ComfortLevelOption {
  return typeof value === "string" && (COMFORT_LEVELS as readonly string[]).includes(value);
}

function isAvailability(value: FormDataEntryValue | null): value is AvailabilityOption {
  return typeof value === "string" && (AVAILABILITY_OPTIONS as readonly string[]).includes(value);
}

export async function completeOnboardingPathB(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const userId = await requireUserId();

  const comfortLevel = formData.get("comfortLevel");
  const availability = formData.get("availability");
  const interestTags = formData.getAll("interestTags").map(String);
  const projectLinks = [
    formData.get("projectLink1"),
    formData.get("projectLink2"),
    formData.get("projectLink3"),
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  if (!isComfortLevel(comfortLevel)) {
    return { error: "Please select a comfort level." };
  }
  if (!isAvailability(availability)) {
    return { error: "Please select your availability." };
  }
  if (interestTags.length === 0) {
    return { error: "Please select at least one interest." };
  }
  for (const tag of interestTags) {
    if (!isInterestTag(tag)) {
      return { error: `Unknown interest tag: ${tag}` };
    }
  }
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

  try {
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        comfortLevel,
        availability,
        interestTags,
        projectLinks,
        onboardingCompletedAt: new Date(),
      },
      update: {
        comfortLevel,
        availability,
        interestTags,
        projectLinks,
        onboardingCompletedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("completeOnboardingPathB failed:", err);
    return {
      error: "Something went wrong saving your profile. Please try again.",
    };
  }

  redirect("/");
}
