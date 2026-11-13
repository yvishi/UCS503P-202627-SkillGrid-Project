// Pure arithmetic for the pilot metrics (definitions from the mid-term
// report). No DB access: scripts/pilot-metrics.ts loads the rows.

export type UserRow = {
  createdAt: Date;
  onboardedAt: Date | null;
  hasResume: boolean;
  hasGithub: boolean;
  extracted: string[];
  kept: string[];
};

export type TeamCounts = {
  teams: number;
  invites: number; // non-PENDING TeamInvites
  accepted: number;
  feedbackGivers: number; // distinct PeerFeedback givers
  eligibleGivers: number; // members of teams whose hackathon has ended
};

export type PilotMetrics = {
  users: number;
  medianTtvpMinutes: number | null;
  completionRate: number | null;
  coverageAny: number | null;
  coverageBoth: number | null;
  parsePrecision: number | null;
  teamsFormed: number;
  inviteAcceptRate: number | null;
  feedbackRate: number | null;
};

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function computeMetrics(rows: readonly UserRow[], teams: TeamCounts): PilotMetrics {
  const onboarded = rows.filter((r) => r.onboardedAt !== null);
  const ttvp = onboarded
    .filter((r) => r.hasResume || r.hasGithub)
    .map((r) => (r.onboardedAt!.getTime() - r.createdAt.getTime()) / 60_000);

  let extractedTotal = 0;
  let keptTotal = 0;
  for (const r of rows) {
    const extracted = new Set(r.extracted);
    extractedTotal += extracted.size;
    keptTotal += [...new Set(r.kept)].filter((s) => extracted.has(s)).length;
  }

  return {
    users: rows.length,
    medianTtvpMinutes: median(ttvp),
    completionRate: ratio(onboarded.length, rows.length),
    coverageAny: ratio(onboarded.filter((r) => r.hasResume || r.hasGithub).length, onboarded.length),
    coverageBoth: ratio(onboarded.filter((r) => r.hasResume && r.hasGithub).length, onboarded.length),
    parsePrecision: ratio(keptTotal, extractedTotal),
    teamsFormed: teams.teams,
    inviteAcceptRate: ratio(teams.accepted, teams.invites),
    feedbackRate: ratio(teams.feedbackGivers, teams.eligibleGivers),
  };
}

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

export function toMarkdownTable(m: PilotMetrics): string {
  const lines: [string, string, string][] = [
    ["Users created", String(m.users), ""],
    ["Median TTVP", m.medianTtvpMinutes === null ? "n/a" : `${m.medianTtvpMinutes.toFixed(1)} min`, "<= 10 min"],
    ["Completion rate", pct(m.completionRate), ""],
    ["Evidence coverage (any source)", pct(m.coverageAny), ">= 60%"],
    ["Evidence coverage (resume and GitHub)", pct(m.coverageBoth), ""],
    ["Parse precision", pct(m.parsePrecision), ""],
    ["Teams formed", String(m.teamsFormed), ""],
    ["Invite accept rate", pct(m.inviteAcceptRate), ""],
    ["Peer feedback rate", pct(m.feedbackRate), ""],
  ];
  return [
    "| Metric | Value | Target |",
    "|---|---|---|",
    ...lines.map(([a, b, c]) => `| ${a} | ${b} | ${c} |`),
  ].join("\n");
}
