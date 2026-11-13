// Pure helpers for the admin review queue (spec 3.2).

import { isSkillCategory, type SkillCategoryName } from "@/lib/skill-catalog-core";
import { validateSkillName } from "@/lib/skill-normalize";

export type RequestRow = {
  id: string;
  userId: string;
  rawName: string;
  key: string;
  note: string | null;
  createdAt: Date;
};

export type ReviewGroup = {
  key: string;
  spellings: { rawName: string; count: number }[];
  reporters: number;
  notes: string[];
  oldest: Date;
  requestIds: string[];
};

/** Pending reports grouped by normalised key -- ten people reporting "SvelteKit" is one decision. */
export function groupRequests(rows: readonly RequestRow[]): ReviewGroup[] {
  const groups = new Map<string, RequestRow[]>();
  for (const row of rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row]);

  return [...groups.entries()]
    .map(([key, items]) => {
      const counts = new Map<string, number>();
      for (const item of items) counts.set(item.rawName, (counts.get(item.rawName) ?? 0) + 1);
      return {
        key,
        spellings: [...counts.entries()]
          .map(([rawName, count]) => ({ rawName, count }))
          .sort((a, b) => b.count - a.count || a.rawName.localeCompare(b.rawName)),
        reporters: new Set(items.map((i) => i.userId)).size,
        notes: items.flatMap((i) => (i.note ? [i.note] : [])),
        oldest: new Date(Math.min(...items.map((i) => i.createdAt.getTime()))),
        requestIds: items.map((i) => i.id).sort(),
      };
    })
    .sort((a, b) => b.reporters - a.reporters || a.oldest.getTime() - b.oldest.getTime());
}

/** The most common spelling -- the default name when approving, and the alias when merging. */
export function pickDisplayName(group: Pick<ReviewGroup, "spellings">): string {
  return group.spellings[0]?.rawName ?? "";
}

export type ApprovalInput = { name: string; slug: string; category: string; aliases: string; strictMatch: boolean };
export type ParsedApproval = {
  name: string;
  slug: string;
  category: SkillCategoryName;
  aliases: string[];
  strictMatch: boolean;
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseApproval(input: ApprovalInput): { ok: true; value: ParsedApproval } | { ok: false; error: string } {
  const name = validateSkillName(input.name);
  if (!name.ok) return { ok: false, error: `Name: ${name.reason}` };
  const slug = input.slug.trim();
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters and digits separated by single hyphens." };
  }
  if (!isSkillCategory(input.category)) return { ok: false, error: "Pick a category." };

  const aliases: string[] = [];
  for (const raw of input.aliases.split(",")) {
    if (!raw.trim()) continue;
    const alias = validateSkillName(raw);
    if (!alias.ok) return { ok: false, error: `Alias "${raw.trim()}": ${alias.reason}` };
    if (!aliases.includes(alias.name)) aliases.push(alias.name);
  }

  return { ok: true, value: { name: name.name, slug, category: input.category, aliases, strictMatch: input.strictMatch } };
}
