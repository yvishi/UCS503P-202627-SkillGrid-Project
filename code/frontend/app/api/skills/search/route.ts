import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getCatalog } from "@/lib/skill-catalog";
import { rankSkills, suggestSimilarIn, type SkillSearchResponse } from "@/lib/skill-catalog-core";
import { MAX_SKILL_NAME_LENGTH } from "@/lib/skill-normalize";

// GET /api/skills/search?q= -- the picker's type-ahead. "Did you mean"
// suggestions are only computed when nothing matched.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_SKILL_NAME_LENGTH);
  if (!q) {
    return NextResponse.json({ results: [], didYouMean: [] } satisfies SkillSearchResponse);
  }

  const catalog = await getCatalog();
  const results = rankSkills(catalog, q, 10);
  const body: SkillSearchResponse = {
    results,
    didYouMean: results.length === 0 ? suggestSimilarIn(catalog, q, 3) : [],
  };
  return NextResponse.json(body);
}
