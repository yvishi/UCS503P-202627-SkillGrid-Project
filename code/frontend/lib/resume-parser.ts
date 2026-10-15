import { PDFParse } from "pdf-parse";

import { extractTextViaOcr, OcrError } from "@/lib/ocr";
import { matchSkillsInText } from "@/lib/resume-matcher";
import { getCatalog } from "@/lib/skill-catalog";

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

// The "slow full parse" from section 4.1: match the extracted text
// (pdf-parse's text layer, or OCR for scanned resumes -- see
// extractResumeText above) against the whole skill catalog. Kept as a
// separate step from the integrity check to preserve the
// fast-check/full-parse split. Matching rules live in lib/resume-matcher.ts.
export async function extractSkillsFromResumeText(text: string): Promise<string[]> {
  return matchSkillsInText(text, await getCatalog());
}
