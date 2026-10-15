import {
  countTopics,
  githubSkillLevels,
  qualifyLanguages,
  recentRepos,
  type GithubSkill,
  type RepoLanguageBytes,
  type RepoSummary,
} from "@/lib/github-skills";
import { findInCatalog } from "@/lib/skill-catalog-core";
import { getCatalog, resolveGithubLanguage } from "@/lib/skill-catalog";

// GitHub is connected as a per-user EVIDENCE source (see app/api/github),
// not a NextAuth sign-in provider -- see auth.ts. This module holds the
// OAuth exchange + API calls that route pair uses; it doesn't touch the
// database, mirroring the resume flow's lib/resume-upload.ts.

export const GITHUB_OAUTH_SCOPE = "read:user";
export const OAUTH_STATE_COOKIE = "github_oauth_state";
export const OAUTH_RETURN_TO_COOKIE = "github_oauth_return_to";

// The three places "Connect GitHub" appears (dashboard, onboarding,
// profile) -- an allowlist rather than a generic "starts with /" check,
// since this drives a server-side redirect target. Exported so
// ConnectGithubButton's `returnTo` prop type is derived from this single
// list instead of keeping its own literal union in sync by hand.
export const RETURN_TO_ALLOWLIST = ["/dashboard", "/profile", "/onboarding"] as const;

export type GithubReturnTo = (typeof RETURN_TO_ALLOWLIST)[number];

export function sanitizeReturnTo(value: string | null | undefined, fallback: string): string {
  if (value && (RETURN_TO_ALLOWLIST as readonly string[]).includes(value)) {
    return value;
  }
  return fallback;
}

function callbackUrl(): string {
  const base = process.env.AUTH_URL;
  if (!base) {
    throw new Error("AUTH_URL is not set -- required to build the GitHub OAuth callback URL.");
  }
  return new URL("/api/github/callback", base).toString();
}

export function buildGithubAuthorizeUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID is not set.");
  }
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth app credentials are not configured.");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl(),
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed with status ${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`GitHub token exchange failed: ${data.error_description ?? data.error ?? "no access_token"}`);
  }
  return data.access_token;
}

function githubApiHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SkillGrid-App",
  };
}

export type GithubUser = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub user lookup failed with status ${res.status}`);
  }
  const data = (await res.json()) as { login: string; name: string | null; avatar_url: string | null };
  return { login: data.login, name: data.name, avatarUrl: data.avatar_url };
}

const MAX_REPOS_LISTED = 100;
const LANGUAGE_FETCH_CONCURRENCY = 5;

// The user's own (non-fork) public repos. Forks are excluded so a forked
// repo doesn't misrepresent the user's own work. `topics` comes back in
// this listing for free.
export async function fetchOwnedRepos(username: string, accessToken: string): Promise<RepoSummary[]> {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.searchParams.set("per_page", String(MAX_REPOS_LISTED));
  url.searchParams.set("type", "owner");
  url.searchParams.set("sort", "pushed");

  const res = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub repo listing failed with status ${res.status}`);
  }
  const repos = (await res.json()) as { name: string; fork: boolean; pushed_at: string | null; topics?: string[] }[];
  return repos
    .filter((r) => !r.fork)
    .map((r) => ({ name: r.name, pushedAt: r.pushed_at ?? "", topics: r.topics ?? [] }));
}

/** Bytes of code per language in one repo (every language, not just the primary one). */
export async function fetchRepoLanguages(owner: string, repo: string, accessToken: string): Promise<RepoLanguageBytes> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
  const res = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub languages for ${repo} failed with status ${res.status}`);
  }
  return (await res.json()) as RepoLanguageBytes;
}

// Runs fn over items, `limit` at a time. A failure skips that item (null)
// instead of failing the whole scan -- one private-turned or rate-limited
// repo shouldn't block connecting GitHub.
async function mapSettled<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        console.error("GitHub scan skipped a repo:", err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Languages (by bytes, across the 30 most recently pushed repos) and topics
 * (across all owned repos) -> scored skills. Languages may add catalog
 * entries (resolveGithubLanguage); topics only count when they match one.
 */
export async function scanGithubSkills(
  username: string,
  accessToken: string,
): Promise<{ skills: GithubSkill[]; reposScanned: number }> {
  const repos = await fetchOwnedRepos(username, accessToken);
  const recent = recentRepos(repos);
  const perRepo = (
    await mapSettled(recent, LANGUAGE_FETCH_CONCURRENCY, (r) => fetchRepoLanguages(username, r.name, accessToken))
  ).filter((bytes): bytes is RepoLanguageBytes => bytes !== null);

  const languages: (ReturnType<typeof qualifyLanguages>[number] & { slug: string })[] = [];
  for (const stat of qualifyLanguages(perRepo)) {
    try {
      const skill = await resolveGithubLanguage(stat.language);
      languages.push({ ...stat, slug: skill.slug });
    } catch (err) {
      console.error(`GitHub language "${stat.language}" could not be resolved; skipping it`, err);
    }
  }

  const catalog = await getCatalog();
  const topics: { slug: string; repos: number }[] = [];
  for (const [topic, count] of countTopics(repos)) {
    const skill = findInCatalog(catalog, topic);
    if (skill) topics.push({ slug: skill.slug, repos: count });
  }

  return { skills: githubSkillLevels({ languages, topics }), reposScanned: recent.length };
}

// EvidenceRecord.payload shape for source: "GITHUB" (spec 4.1). v1 payloads
// (languages: slug[]) are still read by lib/skill-grid.ts.
export type GithubEvidencePayload = {
  version: 2;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  verified: true;
  connectedAt: string;
  reposScanned: number;
  skills: GithubSkill[];
};
