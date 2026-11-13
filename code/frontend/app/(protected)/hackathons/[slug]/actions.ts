"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { createTeam, leaveTeam, setLookingForTeam } from "@/lib/teams";

// Server actions behind TeamPanel. Each one reads the user from auth() and passes
// only that id down; ids in the form name the hackathon or team, never the user.

export type TeamActionState = { ok: boolean; message: string } | null;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const SIGNED_OUT: TeamActionState = { ok: false, message: "Please sign in again." };

async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function revalidate(slug: string) {
  revalidatePath("/hackathons");
  if (slug) revalidatePath(`/hackathons/${slug}`);
}

export async function createTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const userId = await sessionUserId();
  if (!userId) return SIGNED_OUT;
  try {
    const res = await createTeam(userId, field(formData, "hackathonId"), {
      name: field(formData, "name"),
      description: field(formData, "description"),
      lookingFor: field(formData, "lookingFor").split(","),
    });
    if (!res.ok) return { ok: false, message: res.error };
    revalidate(field(formData, "slug"));
    return { ok: true, message: "Team created." };
  } catch (err) {
    console.error("createTeamAction failed:", err);
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function setLookingForTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const userId = await sessionUserId();
  if (!userId) return SIGNED_OUT;
  const looking = field(formData, "looking") === "true";
  try {
    const res = await setLookingForTeam(userId, field(formData, "hackathonId"), looking);
    if (!res.ok) return { ok: false, message: res.error };
    revalidate(field(formData, "slug"));
    return { ok: true, message: looking ? "You're listed as looking for a team." : "You're no longer listed." };
  } catch (err) {
    console.error("setLookingForTeamAction failed:", err);
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function leaveTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const userId = await sessionUserId();
  if (!userId) return SIGNED_OUT;
  try {
    const res = await leaveTeam(userId, field(formData, "teamId"));
    if (!res.ok) return { ok: false, message: res.error };
    revalidate(field(formData, "slug"));
    return { ok: true, message: "You left the team." };
  } catch (err) {
    console.error("leaveTeamAction failed:", err);
    return { ok: false, message: GENERIC_ERROR };
  }
}
