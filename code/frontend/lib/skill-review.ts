import { prisma } from "@/lib/prisma";
import { getCatalog, invalidateCatalog, isUniqueViolation, type Db } from "@/lib/skill-catalog";
import { computeKeys, suggestSimilarIn, type SkillSearchResult } from "@/lib/skill-catalog-core";
import { skillKey } from "@/lib/skill-normalize";
import { groupRequests, parseApproval, pickDisplayName, type ApprovalInput } from "@/lib/skill-review-core";

// Admin side of skill reports (spec 3.2). Each decision is one
// transaction that re-reads the still-pending rows, so a double-click or
// two admins acting at once resolve each report exactly once.

export type QueueGroup = {
  key: string;
  displayName: string;
  spellings: { rawName: string; count: number }[];
  reporters: number;
  notes: string[];
  oldest: string;
  similar: SkillSearchResult[];
};

export async function listReviewQueue(): Promise<QueueGroup[]> {
  const rows = await prisma.skillRequest.findMany({
    where: { status: "PENDING" },
    select: { id: true, userId: true, rawName: true, key: true, note: true, createdAt: true },
  });
  const catalog = await getCatalog();
  return groupRequests(rows).map((g) => ({
    key: g.key,
    displayName: pickDisplayName(g),
    spellings: g.spellings,
    reporters: g.reporters,
    notes: g.notes,
    oldest: g.oldest.toISOString(),
    similar: suggestSimilarIn(catalog, g.key, 3),
  }));
}

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const NOTHING_PENDING: ReviewResult = { ok: true, message: "Nothing pending for this skill any more." };

function people(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

// Marks a group's pending reports resolved and gives every reporter the
// skill at the level they asked for (skipping anyone who already has it).
async function resolveGroup(db: Db, key: string, status: "APPROVED" | "MERGED", skillId: string): Promise<number> {
  const pending = await db.skillRequest.findMany({
    where: { key, status: "PENDING" },
    select: { id: true, userId: true, requestedLevel: true },
  });
  if (pending.length === 0) return 0;
  await db.skillRequest.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { status, resolvedSkillId: skillId, reviewedAt: new Date() },
  });
  await db.userSkill.createMany({
    data: pending.map((p) => ({ userId: p.userId, skillId, level: p.requestedLevel })),
    skipDuplicates: true,
  });
  return new Set(pending.map((p) => p.userId)).size;
}

export async function approveGroup(key: string, input: ApprovalInput): Promise<ReviewResult> {
  const parsed = parseApproval(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { name, slug, category, aliases, strictMatch } = parsed.value;
  const keys = [...new Set([...computeKeys(slug, name, aliases), key])];

  try {
    const result = await prisma.$transaction(async (tx): Promise<ReviewResult> => {
      if ((await tx.skillRequest.count({ where: { key, status: "PENDING" } })) === 0) return NOTHING_PENDING;
      if (await tx.skill.findUnique({ where: { slug }, select: { id: true } })) {
        return { ok: false, error: `The slug "${slug}" is taken. Use Merge into instead.` };
      }
      const clash = await tx.skill.findFirst({ where: { keys: { hasSome: keys } }, select: { name: true } });
      if (clash) return { ok: false, error: `This overlaps with "${clash.name}". Use Merge into instead.` };

      const skill = await tx.skill.create({
        data: { slug, name, aliases, keys, category, strictMatch, origin: "REQUESTED" },
        select: { id: true },
      });
      const n = await resolveGroup(tx, key, "APPROVED", skill.id);
      return { ok: true, message: `Added ${name} for ${people(n)}.` };
    });
    if (result.ok) invalidateCatalog();
    return result;
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That skill was just created. Use Merge into instead." };
    console.error("approveGroup failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function mergeGroup(key: string, targetSlug: string, addAlias: boolean): Promise<ReviewResult> {
  try {
    const result = await prisma.$transaction(async (tx): Promise<ReviewResult> => {
      const pending = await tx.skillRequest.findMany({
        where: { key, status: "PENDING" },
        select: { userId: true, rawName: true, key: true, note: true, id: true, createdAt: true },
      });
      if (pending.length === 0) return NOTHING_PENDING;
      const target = await tx.skill.findUnique({
        where: { slug: targetSlug.trim() },
        select: { id: true, name: true, aliases: true, keys: true },
      });
      if (!target) return { ok: false, error: `No skill with the slug "${targetSlug.trim()}".` };

      if (addAlias) {
        const alias = pickDisplayName(groupRequests(pending)[0]);
        const aliasKey = skillKey(alias);
        const owner = await tx.skill.findFirst({
          where: { keys: { has: aliasKey }, NOT: { id: target.id } },
          select: { name: true },
        });
        if (owner) return { ok: false, error: `"${alias}" already belongs to ${owner.name}. Merge without the alias.` };
        if (!target.keys.includes(aliasKey)) {
          await tx.skill.update({
            where: { id: target.id },
            data: { aliases: [...target.aliases, alias], keys: [...target.keys, aliasKey] },
          });
        }
      }

      const n = await resolveGroup(tx, key, "MERGED", target.id);
      return { ok: true, message: `Merged into ${target.name} for ${people(n)}.` };
    });
    if (result.ok) invalidateCatalog();
    return result;
  } catch (err) {
    console.error("mergeGroup failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function rejectGroup(key: string): Promise<ReviewResult> {
  const { count } = await prisma.skillRequest.updateMany({
    where: { key, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  return count === 0 ? NOTHING_PENDING : { ok: true, message: `Rejected ${count} ${count === 1 ? "report" : "reports"}.` };
}
