import { prisma } from "@/lib/prisma";
import { findSkillByText, isUniqueViolation } from "@/lib/skill-catalog";
import {
  MAX_PENDING_REPORTS,
  parseReportInput,
  type OpenReport,
  type ReportInput,
  type ReportResult,
} from "@/lib/skill-report-input";
import { addUserSkill } from "@/lib/user-skills";

// User side of "report a missing skill" (spec 3.1). A report never adds
// anything to the catalog -- an admin decides (lib/skill-review.ts).

export async function listOpenReports(userId: string): Promise<OpenReport[]> {
  const rows = await prisma.skillRequest.findMany({
    where: { userId, status: { in: ["PENDING", "REJECTED"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, rawName: true, status: true },
  });
  return rows.map((r) => ({ id: r.id, rawName: r.rawName, status: r.status === "REJECTED" ? "REJECTED" : "PENDING" }));
}

export async function reportSkill(userId: string, input: ReportInput): Promise<ReportResult> {
  const parsed = parseReportInput(input);
  if (!parsed.ok) return { status: "error", error: parsed.error };
  const { rawName, key, level, note } = parsed.value;

  // The search may have missed it (typed before an admin approved it, or a
  // spelling variant the cache hadn't caught up with): add it directly
  // instead of queueing a report for something that already exists.
  const existing = await findSkillByText(rawName);
  if (existing) {
    const skill = await addUserSkill(userId, existing.slug, level);
    if (skill) return { status: "exists", skill };
  }

  const pending = await prisma.skillRequest.count({ where: { userId, status: "PENDING" } });
  if (pending >= MAX_PENDING_REPORTS) {
    return {
      status: "error",
      error: `You have ${MAX_PENDING_REPORTS} pending reports. Wait for those to be reviewed first.`,
    };
  }

  try {
    const row = await prisma.skillRequest.create({
      data: { userId, rawName, key, requestedLevel: level, note },
      select: { id: true, rawName: true },
    });
    return { status: "reported", report: { id: row.id, rawName: row.rawName, status: "PENDING" } };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "error", error: "You've already reported this skill." };
    throw err;
  }
}

/** Cancels a pending report or dismisses a rejected one (both just delete the row). */
export async function cancelReport(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.skillRequest.deleteMany({
    where: { id, userId, status: { in: ["PENDING", "REJECTED"] } },
  });
  return count > 0;
}
