import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  buildGithubAuthorizeUrl,
  sanitizeReturnTo,
} from "@/lib/github";

// GET /api/github/start?returnTo=/dashboard|/profile|/onboarding
// Kicks off the OAuth flow shared by all three "Connect GitHub" spots
// (dashboard quick actions, onboarding's GithubStep, profile). Full-page
// navigation only -- GitHub's consent screen can't be reached client-side.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"), "/profile");

  let authorizeUrl: string;
  const state = randomUUID();
  try {
    authorizeUrl = buildGithubAuthorizeUrl(state);
  } catch (err) {
    console.error("GitHub OAuth start failed:", err);
    return NextResponse.redirect(new URL(`${returnTo}?github=error`, request.url));
  }

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // OAuth round-trip should complete in minutes, not longer
  };
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(OAUTH_RETURN_TO_COOKIE, returnTo, cookieOptions);
  return response;
}
