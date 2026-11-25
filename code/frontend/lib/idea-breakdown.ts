// OpenRouter call that breaks a project idea into catalog skills. Prompt
// building and reply parsing are pure and live in lib/idea-breakdown-core.ts.
//
// Like OcrError, `IdeaBreakdownError` is an expected, user-facing failure
// (missing key, rate limit, unusable reply), not a bug.

import { buildIdeaMessages, parseIdeaReply, type IdeaBreakdown } from "@/lib/idea-breakdown-core";
import { getCatalog } from "@/lib/skill-catalog";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const TIMEOUT_MS = 30_000;

export class IdeaBreakdownError extends Error {}

export async function breakDownIdea(idea: string): Promise<IdeaBreakdown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new IdeaBreakdownError("Idea breakdown is not configured (missing OPENROUTER_API_KEY).");
  }

  const catalog = await getCatalog();

  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SkillGrid",
        ...(process.env.AUTH_URL ? { "HTTP-Referer": process.env.AUTH_URL } : {}),
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: buildIdeaMessages(idea, catalog),
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new IdeaBreakdownError(`Could not reach the idea service: ${(err as Error).message}`);
  }

  let data: { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  try {
    data = await response.json();
  } catch {
    throw new IdeaBreakdownError(`Idea service returned HTTP ${response.status}.`);
  }

  if (!response.ok) {
    if (response.status === 429) throw new IdeaBreakdownError("Too many requests right now. Try again in a minute.");
    throw new IdeaBreakdownError(data.error?.message || `Idea service returned HTTP ${response.status}.`);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const breakdown = parseIdeaReply(content, catalog);
  if (!breakdown || breakdown.skills.length === 0) {
    throw new IdeaBreakdownError("Couldn't work out the skills for that idea. Try describing it in more detail.");
  }
  return breakdown;
}
