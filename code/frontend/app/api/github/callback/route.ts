import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mergeSkillRatings, parseSkillRatings } from "@/lib/skills";
import {
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  deriveSkillsFromLanguages,
  exchangeCodeForToken,
  fetchGithubUser,
  fetchPublicRepoLanguages,
  sanitizeReturnTo,
  type GithubEvidencePayload,
} from "@/lib/github";

// GET /api/github/callback -- GitHub redirects here after consent, with
// ?code&state (or ?error on denial). Exchanges the code for a token
// server-side, pulls public repo languages, and saves one GITHUB
// EvidenceRecord (replacing any previous connection -- a user has exactly
// one GitHub account, unlike resumes, which keep history). Then redirects
// back to wherever "Connect GitHub" was clicked from.
export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.cookies.get(OAUTH_RETURN_TO_COOKIE)?.value, "/profile");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  function finish(status: "connected" | "error", extra?: Record<string, string>) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set("github", status);
    for (const [key, value] of Object.entries(extra ?? {})) {
      url.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(url);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(OAUTH_RETURN_TO_COOKIE);
    return response;
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const deniedOrMissing = request.nextUrl.searchParams.get("error");

  if (deniedOrMissing || !code || !state || !expectedState || state !== expectedState) {
    return finish("error");
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await fetchGithubUser(accessToken);
    const languageNames = await fetchPublicRepoLanguages(githubUser.login, accessToken);
    const languages = deriveSkillsFromLanguages(languageNames);

    const payload: GithubEvidencePayload = {
      username: githubUser.login,
      name: githubUser.name,
      avatarUrl: githubUser.avatarUrl,
      verified: true,
      connectedAt: new Date().toISOString(),
      languages,
      repoCount: languageNames.length,
    };

    const record = await prisma.$transaction(async (tx) => {
      // Read-then-merge-then-write on skillRatings, so this must read the
      // current profile inside the same transaction it writes in -- reading
      // outside would let a concurrent connect (two tabs, or a race with
      // onboarding's own profile write) read the same stale skillRatings
      // and clobber whichever write commits second.
      const profile = await tx.profile.findUnique({ where: { userId } });
      const mergedSkillRatings = mergeSkillRatings(parseSkillRatings(profile?.skillRatings), languages);

      // Replace rather than accumulate -- one connected GitHub account per
      // user (also clears out the old unverified-URL placeholder record).
      await tx.evidenceRecord.deleteMany({ where: { userId, source: "GITHUB" } });
      const created = await tx.evidenceRecord.create({ data: { userId, source: "GITHUB", payload } });
      await tx.profile.upsert({
        where: { userId },
        create: { userId, githubUsername: githubUser.login, skillRatings: mergedSkillRatings },
        update: { githubUsername: githubUser.login, skillRatings: mergedSkillRatings },
      });
      return created;
    });

    return finish("connected", { evidenceId: record.id, username: githubUser.login });
  } catch (err) {
    console.error("GitHub OAuth callback failed:", err);
    return finish("error");
  }
}
