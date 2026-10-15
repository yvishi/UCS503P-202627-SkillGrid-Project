"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin";
import { approveGroup, mergeGroup, rejectGroup, type ReviewResult } from "@/lib/skill-review";

export type ReviewActionState = { ok: boolean; message: string } | null;

function toState(result: ReviewResult): ReviewActionState {
  revalidatePath("/admin/skill-requests");
  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.error };
}

const NOT_ALLOWED: ReviewActionState = { ok: false, message: "Not allowed." };

export async function approveAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return toState(
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
  return toState(
    await mergeGroup(
      String(formData.get("key") ?? ""),
      String(formData.get("target") ?? ""),
      formData.get("addAlias") === "on",
    ),
  );
}

export async function rejectAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await getAdminUser())) return NOT_ALLOWED;
  return toState(await rejectGroup(String(formData.get("key") ?? "")));
}
