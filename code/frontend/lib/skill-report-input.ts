// Validation and shared types for "report a missing skill" (spec 3.1).
// Pure, so the picker's client components can import the types and limits.

import { skillKey, validateSkillName } from "@/lib/skill-normalize";
import { isSkillRatingLevel, type SkillRatingLevel, type UserSkillEntry } from "@/lib/skills";

export const MAX_REPORT_NOTE_LENGTH = 200;
export const MAX_PENDING_REPORTS = 10;

export type ReportInput = { rawName: string; level: string; note?: string | null };
export type ParsedReport = { rawName: string; key: string; level: SkillRatingLevel; note: string | null };

/** A report the user can still see: waiting for review, or rejected and not yet dismissed. */
export type OpenReport = { id: string; rawName: string; status: "PENDING" | "REJECTED" };

export type ReportResult =
  | { status: "reported"; report: OpenReport }
  | { status: "exists"; skill: UserSkillEntry }
  | { status: "error"; error: string };

export function parseReportInput(input: ReportInput): { ok: true; value: ParsedReport } | { ok: false; error: string } {
  const name = validateSkillName(input.rawName);
  if (!name.ok) return { ok: false, error: name.reason };
  if (!isSkillRatingLevel(input.level)) return { ok: false, error: "Pick a comfort level for this skill." };
  const note = input.note?.trim() || null;
  if (note && note.length > MAX_REPORT_NOTE_LENGTH) {
    return { ok: false, error: `Notes can be at most ${MAX_REPORT_NOTE_LENGTH} characters.` };
  }
  return { ok: true, value: { rawName: name.name, key: skillKey(name.name), level: input.level, note } };
}
