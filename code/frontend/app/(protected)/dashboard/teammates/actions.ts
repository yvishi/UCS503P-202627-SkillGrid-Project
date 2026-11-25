"use server";

import { auth } from "@/auth";
import { findTeammatesForSkills, type IdeaTeammate } from "@/lib/discovery";
import { breakDownIdea, IdeaBreakdownError } from "@/lib/idea-breakdown";
import { validateIdea, type IdeaSkill } from "@/lib/idea-breakdown-core";

// Server action behind the "Describe your idea" panel on /dashboard/teammates.
// Sends the idea to the LLM (lib/idea-breakdown.ts), then finds people who
// hold any of the skills it picked. Expected failures come back as
// { ok: false, error }; nothing is thrown to the client.

export type IdeaMatchResult =
  | { ok: true; summary: string; skills: IdeaSkill[]; teammates: IdeaTeammate[] }
  | { ok: false; error: string };

// A small per-instance cooldown so one person can't run up the OpenRouter bill
// by hammering the button. Not shared across serverless instances, which is fine
// for a guard against accidental spam.
const COOLDOWN_MS = 5_000;
const lastCall = new Map<string, number>();

export async function matchIdeaAction(idea: string): Promise<IdeaMatchResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in again." };

  const check = validateIdea(idea);
  if (!check.ok) return check;

  const now = Date.now();
  if (now - (lastCall.get(userId) ?? 0) < COOLDOWN_MS) {
    return { ok: false, error: "Give it a few seconds before trying again." };
  }
  lastCall.set(userId, now);

  try {
    const { summary, skills } = await breakDownIdea(check.idea);
    const slugs = skills.flatMap((s) => (s.slug ? [s.slug] : []));
    const teammates = await findTeammatesForSkills(userId, slugs);
    return { ok: true, summary, skills, teammates };
  } catch (err) {
    if (err instanceof IdeaBreakdownError) return { ok: false, error: err.message };
    console.error("matchIdeaAction failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
