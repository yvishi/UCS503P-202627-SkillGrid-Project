import { revalidatePath } from "next/cache";

import {
  FEED_SOURCES,
  autoPublishSources,
  isCurrent,
  isRelevant,
  parseDevfolio,
  parseDevpost,
  parseUnstop,
  uniqueSlug,
  type FeedHackathon,
  type FeedSource,
} from "@/lib/hackathon-feeds-core";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/skill-normalize";

/**
 * Pulls current hackathons from Devfolio, Unstop and Devpost and saves them.
 * Runs daily from app/api/cron/hackathons and on demand from /admin/hackathons.
 */

const HEADERS = { "User-Agent": "SkillGrid hackathon sync", Accept: "application/json" };
const TIMEOUT_MS = 15_000;

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { ...HEADERS, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function field(v: unknown, key: string): unknown {
  return v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined;
}

async function fetchDevfolio(): Promise<FeedHackathon[]> {
  const body = await getJson("https://api.devfolio.co/api/search/hackathons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "application_open", from: 0, size: 100 }),
  });
  return arr(field(field(body, "hits"), "hits")).map(parseDevfolio).filter((h) => h !== null);
}

const UNSTOP_MAX_PAGES = 6;
async function fetchUnstop(): Promise<FeedHackathon[]> {
  const page = (n: number) =>
    getJson(
      `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&oppstatus=open&per_page=50&page=${n}`,
    ).then((b) => field(b, "data"));
  const first = await page(1);
  const last = Math.min(UNSTOP_MAX_PAGES, Number(field(first, "last_page")) || 1);
  const rest = await Promise.all(Array.from({ length: last - 1 }, (_, i) => page(i + 2)));
  return [first, ...rest].flatMap((p) => arr(field(p, "data"))).map(parseUnstop).filter((h) => h !== null);
}

const DEVPOST_MAX_PAGES = 25;
async function fetchDevpost(): Promise<FeedHackathon[]> {
  const page = (n: number) =>
    getJson(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${n}`);
  const first = await page(1);
  const meta = field(first, "meta");
  const pages = Math.min(
    DEVPOST_MAX_PAGES,
    Math.ceil((Number(field(meta, "total_count")) || 0) / (Number(field(meta, "per_page")) || 9)) || 1,
  );
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2)));
  return [first, ...rest].flatMap((p) => arr(field(p, "hackathons"))).map(parseDevpost).filter((h) => h !== null);
}

const FETCHERS: Record<FeedSource, () => Promise<FeedHackathon[]>> = {
  devfolio: fetchDevfolio,
  unstop: fetchUnstop,
  devpost: fetchDevpost,
};

export type SourceResult = { source: FeedSource; fetched: number; created: number; updated: number; error?: string };
export type SyncResult = { sources: SourceResult[] };

type Fetcher = (source: FeedSource) => Promise<FeedHackathon[]>;

/**
 * Fetches every source and upserts by (source, externalId). New hackathons are
 * PUBLISHED when their source auto-publishes, otherwise PENDING for an admin.
 * An existing row keeps its slug and visibility; its name, link and dates
 * follow the source. Team sizes follow too, until a team has formed.
 * One failing source is reported and doesn't stop the others.
 */
export async function syncHackathons(
  opts: { now?: Date; fetcher?: Fetcher; autoPublish?: string } = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const fetcher = opts.fetcher ?? ((s: FeedSource) => FETCHERS[s]());
  const publish = autoPublishSources(opts.autoPublish ?? process.env.HACKATHON_AUTOPUBLISH);

  const fetched = await Promise.all(
    FEED_SOURCES.map(async (source) => {
      try {
        return { source, items: await fetcher(source) };
      } catch (err) {
        return { source, items: [] as FeedHackathon[], error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const taken = new Set((await prisma.hackathon.findMany({ select: { slug: true } })).map((r) => r.slug));
  const sources: SourceResult[] = [];

  for (const { source, items, error } of fetched) {
    // A source can list the same event twice across pages; keep the first.
    const byId = new Map<string, FeedHackathon>();
    for (const h of items) if (isCurrent(h, now) && isRelevant(h) && !byId.has(h.externalId)) byId.set(h.externalId, h);
    const current = [...byId.values()];

    const existing = await prisma.hackathon.findMany({
      where: { source, externalId: { in: current.map((h) => h.externalId) } },
      select: {
        id: true,
        externalId: true,
        name: true,
        url: true,
        location: true,
        startsAt: true,
        endsAt: true,
        teamSizeMin: true,
        teamSizeMax: true,
        _count: { select: { teams: true } },
      },
    });
    const known = new Map(existing.map((r) => [r.externalId, r]));

    const toCreate = current
      .filter((h) => !known.has(h.externalId))
      .map((h) => ({
        source,
        externalId: h.externalId,
        name: h.name,
        slug: uniqueSlug(toSlug(h.name), h, taken),
        url: h.url,
        location: h.location,
        startsAt: h.startsAt,
        endsAt: h.endsAt,
        teamSizeMin: h.teamSizeMin,
        teamSizeMax: h.teamSizeMax,
        visibility: publish.has(source) ? ("PUBLISHED" as const) : ("PENDING" as const),
      }));
    // skipDuplicates covers a concurrent sync having inserted the same rows.
    const created = toCreate.length ? (await prisma.hackathon.createMany({ data: toCreate, skipDuplicates: true })).count : 0;

    let updated = 0;
    for (const h of current) {
      const row = known.get(h.externalId);
      if (!row) continue;
      const sizesLocked = row._count.teams > 0;
      const changed =
        row.name !== h.name ||
        row.url !== h.url ||
        row.location !== h.location ||
        row.startsAt.getTime() !== h.startsAt.getTime() ||
        row.endsAt.getTime() !== h.endsAt.getTime() ||
        (!sizesLocked && (row.teamSizeMin !== h.teamSizeMin || row.teamSizeMax !== h.teamSizeMax));
      if (!changed) continue;
      await prisma.hackathon.update({
        where: { id: row.id },
        data: {
          name: h.name,
          url: h.url,
          location: h.location,
          startsAt: h.startsAt,
          endsAt: h.endsAt,
          ...(sizesLocked ? {} : { teamSizeMin: h.teamSizeMin, teamSizeMax: h.teamSizeMax }),
        },
      });
      updated++;
    }

    sources.push({ source, fetched: current.length, created, updated, ...(error ? { error } : {}) });
  }

  return { sources };
}

/** Runs a sync and refreshes the pages that list hackathons. */
export async function syncAndRevalidate(): Promise<SyncResult> {
  const result = await syncHackathons();
  for (const path of ["/admin/hackathons", "/hackathons", "/dashboard/teams", "/dashboard/teammates", "/teams"]) {
    revalidatePath(path);
  }
  return result;
}
