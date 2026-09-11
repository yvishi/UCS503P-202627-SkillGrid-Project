import { PDFParse } from "pdf-parse";

import { extractTextViaOcr, OcrError } from "@/lib/ocr";
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

// A scanned/image-only resume has no embedded text layer, so pdf-parse
// returns little or nothing -- that's the signal to fall back to OCR
// rather than immediately failing the integrity check. Below this
// length isn't necessarily a real resume either, but it's cheap enough
// to let OCR have a look before giving up.
const OCR_FALLBACK_THRESHOLD = 40;

export type ResumeTextResult = { text: string; usedOcr: boolean; ocrError?: string };

export async function extractResumeText(buffer: Buffer, filename: string): Promise<ResumeTextResult> {
  const pdfText = await extractPdfText(buffer);
  if (pdfText.trim().length >= OCR_FALLBACK_THRESHOLD) {
    return { text: pdfText, usedOcr: false };
  }

  try {
    const ocrText = await extractTextViaOcr(buffer, filename);
    return { text: ocrText, usedOcr: true };
  } catch (err) {
    // Fall back to whatever pdf-parse found (likely nothing) so the
    // integrity check still runs and produces a normal rejection message,
    // rather than the OCR failure masking as an unrelated error.
    const message = err instanceof OcrError ? err.message : "OCR failed unexpectedly.";
    return { text: pdfText, usedOcr: false, ocrError: message };
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

// The "slow full parse" from section 4.1: a keyword match against the
// fixed skill list (lib/skills.ts) run over whichever text source won
// (pdf-parse's text layer, or OCR for scanned resumes -- see
// extractResumeText above). Kept as a separate step from the integrity
// check to preserve the fast-check/full-parse split the spec calls for.
// Plain substring matching false-positives on short/common keywords --
// e.g. "ts" (TypeScript) matches inside "projects", and "git" matches
// inside "digital". Word-boundary matching fixes both, and also stops
// "java" matching inside "javascript". Keywords containing punctuation
// (e.g. "c++", "node.js", " go ") can't use \b cleanly, so those still
// fall back to substring matching.
const ALPHANUMERIC_KEYWORD = /^[a-z0-9]+$/;

function keywordAppears(lower: string, keyword: string): boolean {
  if (ALPHANUMERIC_KEYWORD.test(keyword)) {
    return new RegExp(`\\b${keyword}\\b`).test(lower);
  }
  return lower.includes(keyword);
}

export function extractSkillsFromResumeText(text: string): SkillSlug[] {
  const lower = text.toLowerCase();
  const found: SkillSlug[] = [];
  for (const [slug, keywords] of Object.entries(SKILL_KEYWORDS) as [SkillSlug, string[]][]) {
    if (keywords.some((keyword) => keywordAppears(lower, keyword))) {
      found.push(slug);
    }
  }
  return found;
}
