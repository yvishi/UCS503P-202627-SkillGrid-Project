import { SOURCE_LABEL, isFeedSource } from "@/lib/hackathon-feeds-core";
import type { HackathonPhase } from "@/lib/team-rules";

// Hackathon times are entered and shown in IST, whatever the server's timezone.
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatIst(date: Date): string {
  return `${IST.format(date)} IST`;
}

/** "Online · via Devfolio" for imported hackathons, the location alone (or nothing) otherwise. */
export function originLine(h: { source: string | null; location: string | null }): string | null {
  const via = isFeedSource(h.source) ? `via ${SOURCE_LABEL[h.source]}` : null;
  return [h.location, via].filter(Boolean).join(" · ") || null;
}

export const PHASE_LABEL: Record<HackathonPhase, string> = {
  upcoming: "Upcoming",
  running: "Running",
  ended: "Ended",
};
