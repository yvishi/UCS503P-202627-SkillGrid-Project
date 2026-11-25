import { NextResponse, type NextRequest } from "next/server";

import { syncAndRevalidate } from "@/lib/hackathon-feeds";

// Fetching ~15 feed pages and saving a few hundred rows takes well over the default.
export const maxDuration = 60;

// GET /api/cron/hackathons -- Vercel Cron (vercel.json) calls this daily with
// "Authorization: Bearer $CRON_SECRET". Without CRON_SECRET set, it refuses everyone.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncAndRevalidate());
}
