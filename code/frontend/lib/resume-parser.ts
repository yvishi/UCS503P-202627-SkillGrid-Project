import { PDFParse } from "pdf-parse";

import { SKILL_KEYWORDS, type SkillSlug } from "@/lib/skills";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export type IntegrityCheckResult = { passed: boolean; reason?: string };

// Section 6 of the spec: a fast, blocking, rule-based classification --
// not full extraction -- so a non-resume upload gets caught before the
// user proceeds into the rest of onboarding.
const SECTION_HEADERS = [
  "experience",
  "education",
  "projects",
  "skills",
  "work experience",
  "objective",
  "summary",
];
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/;
const MIN_TEXT_LENGTH = 120;
const MAX_TEXT_LENGTH = 200_000; // guards against a 500-page dump

export function checkResumeIntegrity(text: string): IntegrityCheckResult {
  const normalized = text.trim();

  if (normalized.length < MIN_TEXT_LENGTH) {
    return { passed: false, reason: "The file has too little extractable text to be a resume." };
  }
  if (normalized.length > MAX_TEXT_LENGTH) {
    return { passed: false, reason: "The file is too long to be a resume." };
  }

  const lower = normalized.toLowerCase();
  const hasSectionHeader = SECTION_HEADERS.some((header) => lower.includes(header));
  const hasEmail = EMAIL_PATTERN.test(normalized);
  const hasPhone = PHONE_PATTERN.test(normalized);

  if (!hasSectionHeader) {
    return { passed: false, reason: "This doesn't look like a resume — no resume-style sections found." };
  }
  if (!hasEmail && !hasPhone) {
    return { passed: false, reason: "This doesn't look like a resume — no contact information found." };
  }

  return { passed: true };
}

// The "slow full parse" from section 4.1. In this phase there's no
// OCR/ML pipeline (deferred per spec) -- this is a keyword match against
// the fixed skill list (lib/skills.ts), which is fast in practice but
// kept as a separate step from the integrity check to preserve the
// fast-check/full-parse split the spec calls for.
export function extractSkillsFromResumeText(text: string): SkillSlug[] {
  const lower = text.toLowerCase();
  const found: SkillSlug[] = [];
  for (const [slug, keywords] of Object.entries(SKILL_KEYWORDS) as [SkillSlug, string[]][]) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      found.push(slug);
    }
  }
  return found;
}
