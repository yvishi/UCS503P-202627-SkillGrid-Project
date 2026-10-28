import { toSlug } from "@/lib/skill-normalize";

export const MAX_TEAM_SIZE = 8;

export type ParsedHackathon = {
  name: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  teamSizeMin: number;
  teamSizeMax: number;
};

function parseSize(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= MAX_TEAM_SIZE ? n : null;
}

/** Hackathon times are entered in IST; a value with no explicit offset is read as Asia/Kolkata (+05:30). */
function parseDate(raw: string | undefined): Date | null {
  let text = (raw ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) text += ":00+05:30";
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) text += "+05:30";
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseHackathonInput(
  form: Record<string, string>,
): { ok: true; value: ParsedHackathon } | { ok: false; error: string } {
  const name = (form.name ?? "").trim();
  if (name.length < 3 || name.length > 80) return { ok: false, error: "The name must be 3 to 80 characters." };

  const givenSlug = (form.slug ?? "").trim();
  const slug = givenSlug ? toSlug(givenSlug) : toSlug(name);
  if (!slug) return { ok: false, error: "Enter a slug using letters and numbers." };

  const startsAt = parseDate(form.startsAt);
  if (!startsAt) return { ok: false, error: "Enter a valid start date." };
  const endsAt = parseDate(form.endsAt);
  if (!endsAt) return { ok: false, error: "Enter a valid end date." };
  if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "The end must be after the start." };

  const teamSizeMin = parseSize(form.teamSizeMin);
  const teamSizeMax = parseSize(form.teamSizeMax);
  if (teamSizeMin === null || teamSizeMax === null) {
    return { ok: false, error: `Team sizes must be whole numbers from 1 to ${MAX_TEAM_SIZE}.` };
  }
  if (teamSizeMin > teamSizeMax) {
    return { ok: false, error: "The minimum team size can't be more than the maximum." };
  }

  return { ok: true, value: { name, slug, startsAt, endsAt, teamSizeMin, teamSizeMax } };
}
