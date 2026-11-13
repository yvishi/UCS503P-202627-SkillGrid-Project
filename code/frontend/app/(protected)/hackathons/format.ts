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

export const PHASE_LABEL: Record<HackathonPhase, string> = {
  upcoming: "Upcoming",
  running: "Running",
  ended: "Ended",
};
