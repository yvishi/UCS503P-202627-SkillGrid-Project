import { uploadResume } from "@/lib/blob";
import {
  checkResumeIntegrity,
  extractResumeText,
  extractSkillsFromResumeText,
} from "@/lib/resume-parser";
import type { SkillSlug } from "@/lib/skills";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ResumeUploadResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      fileUrl: string;
      filename: string;
      extractedSkills: SkillSlug[];
      usedOcr: boolean;
    };

// Shared by the onboarding resume step and the post-onboarding re-upload
// flow (app/(protected)/profile/resume): validate, extract text (pdf-parse,
// falling back to OCR for scanned files -- see lib/resume-parser.ts), run
// the integrity check, extract skills, then upload to blob storage. Doesn't
// touch the database -- callers decide what to do with the result (create
// an EvidenceRecord, update Profile.skillRatings, etc).
export async function processResumeUpload(userId: string, file: File): Promise<ResumeUploadResult> {
  if (file.size === 0) {
    return { ok: false, reason: "Please upload a resume to continue." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { ok: false, reason: "Resume must be 5MB or smaller." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, reason: "Resume must be a PDF file." };
  }

  let text: string;
  let usedOcr: boolean;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractResumeText(buffer, file.name);
    text = result.text;
    usedOcr = result.usedOcr;
    if (result.ocrError) {
      console.error("OCR fallback failed:", result.ocrError);
    }
  } catch (err) {
    console.error("extractResumeText failed:", err);
    return {
      ok: false,
      reason: "Couldn't read that PDF. Try a different file, or continue manually instead.",
    };
  }

  const integrity = checkResumeIntegrity(text);
  if (!integrity.passed) {
    return { ok: false, reason: integrity.reason! };
  }

  const extractedSkills = extractSkillsFromResumeText(text);

  try {
    const fileUrl = await uploadResume(userId, file);
    return { ok: true, fileUrl, filename: file.name, extractedSkills, usedOcr };
  } catch (err) {
    console.error("uploadResume failed:", err);
    return { ok: false, reason: "Something went wrong uploading your resume. Please try again." };
  }
}
