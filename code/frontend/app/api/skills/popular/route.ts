import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getCatalog } from "@/lib/skill-catalog";
import { isSkillCategory, popularIn } from "@/lib/skill-catalog-core";

// GET /api/skills/popular?category=LANGUAGE -- the picker's browse panel.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get("category") ?? "";
  if (!isSkillCategory(category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  return NextResponse.json({ results: popularIn(await getCatalog(), category, 12) });
}
