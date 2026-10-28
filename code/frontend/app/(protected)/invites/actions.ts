"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { RuleResult } from "@/lib/team-rules";
import {
  acceptInvite,
  cancelInvite,
  declineInvite,
  hackathonSlugForInvite,
  hackathonSlugForTeam,
  inviteToTeam,
  requestToJoin,
} from "@/lib/teams";

// Server actions for invitations and join requests. Used by /invites and, through Task I.1,
// by the discovery cards. The actor is always the session user from auth(); arguments only
// name the team, the invite, or (for an invite) the person being invited.
// Expected failures come back as { ok: false, error }; nothing is thrown to the client.

const SIGNED_OUT: RuleResult = { ok: false, error: "Please sign in again." };
const GENERIC_ERROR: RuleResult = { ok: false, error: "Something went wrong. Please try again." };

async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function revalidate(slug: string | null) {
  revalidatePath("/invites");
  if (slug) revalidatePath(`/hackathons/${slug}`);
}

/** Runs `work` as the session user and revalidates on success. */
async function run(
  name: string,
  slugOf: () => Promise<string | null>,
  work: (userId: string) => Promise<RuleResult>,
): Promise<RuleResult> {
  const userId = await sessionUserId();
  if (!userId) return SIGNED_OUT;
  try {
    const res = await work(userId);
    if (res.ok) revalidate(await slugOf());
    return res;
  } catch (err) {
    console.error(`${name} failed:`, err);
    return GENERIC_ERROR;
  }
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export async function inviteToTeamAction(teamId: string, userId: string): Promise<RuleResult> {
  if (!isId(teamId) || !isId(userId)) return { ok: false, error: "That invite isn't valid." };
  return run(
    "inviteToTeamAction",
    () => hackathonSlugForTeam(teamId),
    (actorId) => inviteToTeam(actorId, teamId, userId),
  );
}

export async function requestToJoinAction(teamId: string): Promise<RuleResult> {
  if (!isId(teamId)) return { ok: false, error: "That team no longer exists." };
  return run(
    "requestToJoinAction",
    () => hackathonSlugForTeam(teamId),
    (actorId) => requestToJoin(actorId, teamId),
  );
}

export async function respondToInviteAction(inviteId: string, accept: boolean): Promise<RuleResult> {
  if (!isId(inviteId)) return { ok: false, error: "That invite no longer exists." };
  return run(
    "respondToInviteAction",
    () => hackathonSlugForInvite(inviteId),
    (actorId) => (accept === true ? acceptInvite(actorId, inviteId) : declineInvite(actorId, inviteId)),
  );
}

export async function cancelInviteAction(inviteId: string): Promise<RuleResult> {
  if (!isId(inviteId)) return { ok: false, error: "That invite no longer exists." };
  return run(
    "cancelInviteAction",
    () => hackathonSlugForInvite(inviteId),
    (actorId) => cancelInvite(actorId, inviteId),
  );
}
