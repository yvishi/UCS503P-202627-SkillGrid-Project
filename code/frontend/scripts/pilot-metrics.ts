// Usage: npx tsx scripts/pilot-metrics.ts --since 2026-11-01 [--until 2026-12-01]
// Prints the pilot metrics table (arithmetic lives in lib/pilot-metrics-core.ts).
import { prisma } from "../lib/prisma";
import { findActiveResumePayload } from "../lib/evidence";
import { resumeSkillsFromPayload } from "../lib/skill-grid";
import { computeMetrics, toMarkdownTable, type UserRow } from "../lib/pilot-metrics-core";

function arg(name: string): Date | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const d = new Date(process.argv[i + 1] ?? "");
  if (Number.isNaN(d.getTime())) throw new Error(`--${name} needs a date such as 2026-11-01`);
  return d;
}

async function main() {
  const since = arg("since");
  if (!since) throw new Error("Usage: pilot-metrics.ts --since YYYY-MM-DD [--until YYYY-MM-DD]");
  const until = arg("until");
  const created = { gte: since, ...(until ? { lt: until } : {}) };

  const users = await prisma.user.findMany({
    where: { createdAt: created },
    select: {
      id: true,
      createdAt: true,
      profile: { select: { onboardingCompletedAt: true, activeResumeId: true } },
      evidenceRecords: { where: { source: { in: ["RESUME", "GITHUB"] } }, select: { source: true } },
      skills: { select: { skill: { select: { slug: true } } } },
    },
  });

  const rows: UserRow[] = [];
  for (const u of users) {
    const payload = await findActiveResumePayload(u.id, u.profile?.activeResumeId ?? null);
    rows.push({
      createdAt: u.createdAt,
      onboardedAt: u.profile?.onboardingCompletedAt ?? null,
      hasResume: u.evidenceRecords.some((e) => e.source === "RESUME"),
      hasGithub: u.evidenceRecords.some((e) => e.source === "GITHUB"),
      extracted: resumeSkillsFromPayload(payload),
      kept: u.skills.map((s) => s.skill.slug),
    });
  }

  const now = new Date();
  const [teams, invites, accepted, endedTeams] = await Promise.all([
    prisma.team.count({ where: { createdAt: created } }),
    prisma.teamInvite.count({ where: { createdAt: created, status: { not: "PENDING" } } }),
    prisma.teamInvite.count({ where: { createdAt: created, status: "ACCEPTED" } }),
    prisma.team.findMany({
      where: { createdAt: created, hackathon: { endsAt: { lt: now } } },
      select: { id: true, members: { select: { userId: true } } },
    }),
  ]);
  const eligible = new Set(endedTeams.flatMap((t) => t.members.map((m) => m.userId)));
  const givers = await prisma.peerFeedback.findMany({
    where: { teamId: { in: endedTeams.map((t) => t.id) } },
    distinct: ["fromUserId"],
    select: { fromUserId: true },
  });

  const metrics = computeMetrics(rows, {
    teams,
    invites,
    accepted,
    feedbackGivers: givers.length,
    eligibleGivers: eligible.size,
  });
  console.log(`Pilot metrics, users created from ${since.toISOString().slice(0, 10)}${until ? ` to ${until.toISOString().slice(0, 10)}` : ""}\n`);
  console.log(toMarkdownTable(metrics));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
