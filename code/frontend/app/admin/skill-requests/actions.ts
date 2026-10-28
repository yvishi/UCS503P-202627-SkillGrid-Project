"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin";
import { approveGroup, mergeGroup, rejectGroup, type ReviewResult } from "@/lib/skill-review";
import { recomputeUserScoresSafely } from "@/lib/skill-score";

export type ReviewActionState = { ok: boolean; message: string } | null;

// Approving or merging gives reporters new UserSkill rows, so their scores are recomputed.
async function toState(result: ReviewResult): Promise<ReviewActionState> {
  if (result.ok) {
    for (const userId of result.userIds ?? []) await recomputeUserScoresSafely(userId);
  }
  revalidatePath("/admin/skill-requests");
  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.error };
}

const NOT_ALLOWED: ReviewActionState = { ok: false, message: "Not allowed." };

export async function approveAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return await toState(
    await approveGroup(String(formData.get("key") ?? ""), {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      category: String(formData.get("category") ?? ""),
      aliases: String(formData.get("aliases") ?? ""),
      strictMatch: formData.get("strictMatch") === "on",
    }),
  );
}

export async function mergeAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return await toState(
    await mergeGroup(
      String(formData.get("key") ?? ""),
      String(formData.get("target") ?? ""),
      formData.get("addAlias") === "on",
    ),
  );
}

export async function rejectAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return await toState(await rejectGroup(String(formData.get("key") ?? "")));
}
