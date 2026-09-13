import { mapGithubLanguageToSkill, type SkillSlug } from "@/lib/skills";

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

const MAX_REPOS_SCANNED = 100;

// One primary language per repo (GitHub's own `language` field, not a full
// byte-count breakdown -- that would need one extra API call per repo).
// Forks are excluded so a starred/forked repo doesn't misrepresent the
// user's own work. Returns language names with repeats, so callers can
// rank by how often each one shows up.
export async function fetchPublicRepoLanguages(username: string, accessToken: string): Promise<string[]> {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.searchParams.set("per_page", String(MAX_REPOS_SCANNED));
  url.searchParams.set("type", "owner");
  url.searchParams.set("sort", "pushed");

  const res = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`GitHub repo listing failed with status ${res.status}`);
  }
  const repos = (await res.json()) as { language: string | null; fork: boolean }[];
  return repos.filter((r) => !r.fork && r.language).map((r) => r.language as string);
}

// Ranks by frequency (most-used language first) and maps to the fixed
// skill list (lib/skills.ts) -- languages with no corresponding skill slug
// (e.g. "HTML", "Shell") are dropped rather than left unmapped.
export function deriveSkillsFromLanguages(languageNames: string[]): SkillSlug[] {
  const counts = new Map<string, number>();
  for (const name of languageNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  const slugs: SkillSlug[] = [];
  for (const name of ranked) {
    const slug = mapGithubLanguageToSkill(name);
    if (slug && !slugs.includes(slug)) {
      slugs.push(slug);
    }
  }
  return slugs;
}

// EvidenceRecord.payload shape for source: "GITHUB" (see prisma/schema.prisma).
export type GithubEvidencePayload = {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  verified: true;
  connectedAt: string;
  languages: SkillSlug[];
  repoCount: number;
};
