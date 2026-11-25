import { MAX_TEAM_SIZE } from "@/lib/hackathon-input";

/**
 * Normalisers for the public hackathon listings SkillGrid imports from.
 * Pure functions only: lib/hackathon-feeds.ts does the fetching and saving.
 *
 * None of these endpoints is a documented, versioned API, so every field is
 * read defensively and an entry that doesn't parse is skipped, never thrown.
 */

export const FEED_SOURCES = ["devfolio", "unstop", "devpost"] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

export const SOURCE_LABEL: Record<FeedSource, string> = {
  devfolio: "Devfolio",
  unstop: "Unstop",
  devpost: "Devpost",
};

export function isFeedSource(value: unknown): value is FeedSource {
  return typeof value === "string" && (FEED_SOURCES as readonly string[]).includes(value);
}

export type FeedHackathon = {
  source: FeedSource;
  externalId: string;
  name: string;
  url: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  teamSizeMin: number;
  teamSizeMax: number;
};

type Json = Record<string, unknown>;

function obj(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function date(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function int(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

const DEFAULT_TEAM = { teamSizeMin: 1, teamSizeMax: 4 };

/** Clamps a source's team sizes into what SkillGrid allows (1..MAX_TEAM_SIZE). */
export function teamSizes(min: unknown, max: unknown): { teamSizeMin: number; teamSizeMax: number } {
  const lo = int(min);
  const hi = int(max);
  if (lo === null && hi === null) return DEFAULT_TEAM;
  const clamp = (n: number) => Math.min(MAX_TEAM_SIZE, Math.max(1, n));
  const a = clamp(lo ?? 1);
  const b = clamp(hi ?? Math.max(a, DEFAULT_TEAM.teamSizeMax));
  return { teamSizeMin: Math.min(a, b), teamSizeMax: Math.max(a, b) };
}

/** Names are 3 to 80 characters elsewhere in the app; long feed titles are cut at a word. */
export function cleanName(raw: unknown): string | null {
  const name = str(raw)?.replace(/\s+/g, " ");
  if (!name || name.length < 3) return null;
  if (name.length <= 80) return name;
  const cut = name.slice(0, 79);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function finish(h: Omit<FeedHackathon, "name"> & { name: unknown }): FeedHackathon | null {
  const name = cleanName(h.name);
  if (!name || !h.externalId) return null;
  if (h.endsAt.getTime() <= h.startsAt.getTime()) return null;
  return { ...h, name };
}

/** One `_source` from Devfolio's search endpoint (api.devfolio.co/api/search/hackathons). */
export function parseDevfolio(raw: unknown): FeedHackathon | null {
  const s = obj(obj(raw)?._source ?? raw);
  if (!s) return null;
  const startsAt = date(s.starts_at);
  const endsAt = date(s.ends_at);
  const slug = str(s.slug);
  if (!startsAt || !endsAt || !slug) return null;
  const online = s.is_online === true;
  return finish({
    source: "devfolio",
    externalId: str(s.uuid) ?? slug,
    name: s.name,
    url: `https://${slug}.devfolio.co/`,
    location: online ? "Online" : (str(s.city) ?? str(s.location)),
    startsAt,
    endsAt,
    ...teamSizes(s.team_min, s.team_size),
  });
}

/**
 * One item from Unstop's opportunity search. Unstop has no single event start,
 * so a hackathon runs, for SkillGrid's purposes, from registration opening to
 * the opportunity's end: the window in which teams form.
 */
export function parseUnstop(raw: unknown): FeedHackathon | null {
  const s = obj(raw);
  if (!s) return null;
  const regn = obj(s.regnRequirements) ?? {};
  const startsAt = date(regn.start_regn_dt) ?? date(s.start_date) ?? date(s.approved_date);
  const endsAt = date(s.end_date) ?? date(regn.end_regn_dt);
  const id = int(s.id);
  if (!startsAt || !endsAt || id === null) return null;
  const region = str(s.region);
  const publicUrl = str(s.public_url);
  return finish({
    source: "unstop",
    externalId: String(id),
    name: s.title,
    url: str(s.seo_url) ?? (publicUrl ? `https://unstop.com/${publicUrl.replace(/^\//, "")}` : null),
    location: region === "online" ? "Online" : region ? region[0].toUpperCase() + region.slice(1) : null,
    startsAt,
    endsAt,
    ...teamSizes(regn.min_team_size, regn.max_team_size),
  });
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** A calendar day in IST as a UTC instant: midnight, or 23:59:59 for the last day. */
function istDay(year: number, month: number, day: number, endOfDay: boolean): Date {
  const utc = Date.UTC(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return new Date(utc - 330 * 60 * 1000);
}

/**
 * Devpost only gives a display string for its submission period:
 *   "Nov 11 - 30, 2026", "Oct 30 - Dec 04, 2026", "Nov 11, 2026 - Jan 11, 2027", "Dec 01, 2026".
 * Read as whole days in IST.
 */
export function parseDevpostDates(raw: unknown): { startsAt: Date; endsAt: Date } | null {
  const text = str(raw);
  if (!text) return null;
  const part = String.raw`([A-Za-z]{3})?\s*(\d{1,2})(?:,\s*(\d{4}))?`;
  const m = new RegExp(String.raw`^${part}(?:\s*[-–]\s*${part})?$`).exec(text);
  if (!m) return null;
  const [, m1, d1, y1, m2, d2, y2] = m;
  const month1 = m1 ? MONTHS[m1.toLowerCase()] : undefined;
  if (month1 === undefined) return null;
  const endYear = Number(y2 ?? y1);
  if (!endYear) return null;
  const startYear = Number(y1 ?? endYear);
  if (!d2) {
    return { startsAt: istDay(startYear, month1, Number(d1), false), endsAt: istDay(startYear, month1, Number(d1), true) };
  }
  const month2 = m2 ? MONTHS[m2.toLowerCase()] : month1;
  if (month2 === undefined) return null;
  // "Dec 20 - Jan 05, 2027" with no first year: the start is in the year before.
  const startYearFixed = !y1 && month1 > month2 ? endYear - 1 : startYear;
  return {
    startsAt: istDay(startYearFixed, month1, Number(d1), false),
    endsAt: istDay(endYear, month2, Number(d2), true),
  };
}

/** One entry from devpost.com/api/hackathons. Devpost doesn't list team sizes, so the default range is used. */
export function parseDevpost(raw: unknown): FeedHackathon | null {
  const s = obj(raw);
  if (!s) return null;
  const id = int(s.id);
  const dates = parseDevpostDates(s.submission_period_dates);
  if (id === null || !dates) return null;
  if (s.invite_only === true) return null;
  return finish({
    source: "devpost",
    externalId: String(id),
    name: s.title,
    url: str(s.url),
    location: str(obj(s.displayed_location)?.location),
    ...dates,
    ...DEFAULT_TEAM,
  });
}

/** Keeps hackathons worth showing: not over yet, and not starting absurdly far out. */
export function isCurrent(h: FeedHackathon, now: Date, horizonDays = 120): boolean {
  if (h.endsAt.getTime() <= now.getTime()) return false;
  return h.startsAt.getTime() <= now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
}

/**
 * Sources whose new imports go straight to students. Comes from
 * HACKATHON_AUTOPUBLISH ("devfolio,unstop"); unset means Devfolio only, the
 * one feed that's consistently tech hackathons. Everything else waits in the
 * admin queue as PENDING.
 */
export function autoPublishSources(raw: string | undefined): Set<FeedSource> {
  if (raw === undefined) return new Set(["devfolio"]);
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(isFeedSource));
}

/** Devpost lists in-person events worldwide; only its online ones are reachable from campus. */
export function isRelevant(h: FeedHackathon): boolean {
  if (h.source === "devpost") return (h.location ?? "").toLowerCase() === "online";
  return true;
}

/**
 * Picks a slug that isn't in `taken`, adding it to `taken`. Imported names
 * collide often ("HackFest 2026" is on several feeds), so the source and then
 * its id are appended until one is free.
 */
export function uniqueSlug(base: string, h: Pick<FeedHackathon, "source" | "externalId">, taken: Set<string>): string {
  const root = base.slice(0, 60).replace(/-+$/, "") || "hackathon";
  const tail = h.externalId.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 10);
  for (const candidate of [root, `${root}-${h.source}`, `${root}-${h.source}-${tail}`]) {
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  let n = 2;
  while (taken.has(`${root}-${h.source}-${tail}-${n}`)) n++;
  const slug = `${root}-${h.source}-${tail}-${n}`;
  taken.add(slug);
  return slug;
}
