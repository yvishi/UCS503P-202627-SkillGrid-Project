// Demo data so a real account can try every feature: hackathons in each phase,
// teams to browse and join, invites and join requests in every direction,
// teammates to discover, and peer feedback (given and waiting to be given).
//
// Run:   npx tsx prisma/scripts/seed-demo.ts [--user you@example.com]
// Undo:  npx tsx prisma/scripts/seed-demo.ts --clean [--user you@example.com]
//
// Safe to re-run: it removes its own data first. Demo users all use the
// @demo.skillgrid.dev domain and demo hackathons use the slugs in HACKATHONS,
// so cleaning never touches real users or real hackathons. Dates are relative
// to "now", so re-run it if the demo goes stale (e.g. a hackathon has ended).

import type { Availability, ComfortLevel } from "@prisma/client";

import { rebuildPeerEvidence } from "@/lib/peer-feedback";
import { prisma } from "@/lib/prisma";
import { recomputeUserScores } from "@/lib/skill-score";

const DEMO_DOMAIN = "demo.skillgrid.dev";
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days: number) => new Date(now + days * DAY);

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const userIdx = args.indexOf("--user");
const MY_EMAIL = userIdx >= 0 ? args[userIdx + 1] : "y.v.s.vishnoi@gmail.com";

const B: ComfortLevel = "BEGINNER";
const I: ComfortLevel = "INTERMEDIATE";
const A: ComfortLevel = "ADVANCED";

type DemoUser = {
  key: string;
  name: string;
  bio: string;
  interests: string[];
  availability: Availability;
  skills: Record<string, ComfortLevel>;
  github?: Record<string, 2 | 3 | 4>; // verified GitHub evidence
  resume?: string[]; // skills "found" on a resume
};

const USERS: DemoUser[] = [
  { key: "aarav", name: "Aarav Sharma", bio: "Full-stack dev, loves shipping fast.", interests: ["Web Dev", "Backend"], availability: "BOTH",
    skills: { typescript: A, react: A, nodejs: I, postgresql: I, docker: B }, github: { typescript: 4, react: 4, nodejs: 3 }, resume: ["typescript", "react", "nodejs"] },
  { key: "ishita", name: "Ishita Verma", bio: "ML student, Kaggle regular.", interests: ["Machine Learning", "Data Science"], availability: "WEEKENDS",
    skills: { python: A, pytorch: A, "scikit-learn": I, pandas: A, "computer-vision": I }, github: { python: 4, pytorch: 3 }, resume: ["python", "pytorch", "pandas"] },
  { key: "rohan", name: "Rohan Mehta", bio: "Backend and infra. Kubernetes enjoyer.", interests: ["DevOps", "Cloud", "Backend"], availability: "FLEXIBLE",
    skills: { go: A, kubernetes: I, docker: A, aws: I, terraform: I }, github: { go: 4, docker: 3 } },
  { key: "kabir", name: "Kabir Singh", bio: "Android + Kotlin. Building a habit tracker.", interests: ["Mobile"], availability: "WEEKDAYS",
    skills: { kotlin: A, android: A, java: I, firebase: I }, github: { kotlin: 4, java: 3 }, resume: ["kotlin", "android", "java"] },
  { key: "ananya", name: "Ananya Iyer", bio: "Product designer who codes a little.", interests: ["Design (UI/UX)", "Frontend", "Product/Business"], availability: "BOTH",
    skills: { figma: A, "ui-ux-design": A, css: I, react: B }, resume: ["figma", "ui-ux-design", "css"] },
  { key: "sneha", name: "Sneha Reddy", bio: "Data engineer in training.", interests: ["Data Science", "Cloud"], availability: "WEEKENDS",
    skills: { sql: A, python: I, "apache-spark": I, airflow: B, "power-bi": I }, github: { python: 3, sql: 3 } },
  { key: "dev", name: "Dev Patel", bio: "Security CTF player.", interests: ["Security", "Backend"], availability: "FLEXIBLE",
    skills: { cybersecurity: A, linux: A, python: I, "penetration-testing": I, cpp: I }, github: { python: 3, cpp: 3 } },
  { key: "meera", name: "Meera Nair", bio: "Frontend perfectionist. Tailwind evangelist.", interests: ["Frontend", "Web Dev", "Design (UI/UX)"], availability: "BOTH",
    skills: { react: A, nextjs: A, "tailwind-css": A, typescript: I, figma: I }, github: { typescript: 4, react: 4, "tailwind-css": 3 }, resume: ["react", "nextjs"] },
  { key: "arjun", name: "Arjun Gupta", bio: "Competitive programmer, C++ main.", interests: ["Game Dev", "Backend"], availability: "WEEKDAYS",
    skills: { cpp: A, dsa: A, "competitive-programming": A, python: I }, github: { cpp: 4 } },
  { key: "priya", name: "Priya Kapoor", bio: "LLM apps and prompt engineering.", interests: ["Machine Learning", "Web Dev"], availability: "FLEXIBLE",
    skills: { python: A, langchain: I, "openai-api": A, fastapi: I, llms: I }, github: { python: 4, fastapi: 3 }, resume: ["python", "langchain", "fastapi"] },
  { key: "vikram", name: "Vikram Joshi", bio: "IoT tinkerer, Arduino and ESP32.", interests: ["Embedded/IoT"], availability: "WEEKENDS",
    skills: { arduino: A, "embedded-systems": I, c: A, "raspberry-pi": I } },
  { key: "tanvi", name: "Tanvi Desai", bio: "Flutter dev, two apps on the Play Store.", interests: ["Mobile", "Frontend"], availability: "BOTH",
    skills: { flutter: A, dart: A, firebase: I, figma: B }, github: { dart: 4, flutter: 4 } },
  { key: "nikhil", name: "Nikhil Rao", bio: "Smart contracts and DeFi.", interests: ["Blockchain", "Backend"], availability: "FLEXIBLE",
    skills: { solidity: A, ethereum: I, hardhat: I, javascript: I }, github: { solidity: 3, javascript: 3 } },
  { key: "zoya", name: "Zoya Khan", bio: "Unity game dev and 3D art.", interests: ["Game Dev", "Design (UI/UX)"], availability: "WEEKENDS",
    skills: { unity: A, csharp: A, blender: I }, github: { csharp: 4 } },
  { key: "harsh", name: "Harsh Malhotra", bio: "Django and REST APIs.", interests: ["Backend", "Web Dev"], availability: "WEEKDAYS",
    skills: { python: A, django: A, postgresql: I, "rest-apis": A, redis: B }, resume: ["python", "django", "postgresql"] },
  { key: "riya", name: "Riya Bansal", bio: "Cloud and serverless on GCP.", interests: ["Cloud", "DevOps"], availability: "FLEXIBLE",
    skills: { "google-cloud": A, docker: I, nodejs: I, "github-actions": I }, github: { javascript: 3 } },
];

const HACKATHONS = {
  running: { slug: "hackindia-open-2026", name: "HackIndia Open 2026", startsAt: at(-3), endsAt: at(4), teamSizeMin: 2, teamSizeMax: 4 },
  winter: { slug: "thapar-winter-hack-2026", name: "Thapar Winter Hack 2026", startsAt: at(17), endsAt: at(19), teamSizeMin: 2, teamSizeMax: 4 },
  spring: { slug: "spring-ai-challenge-2027", name: "Spring AI Challenge 2027", startsAt: at(75), endsAt: at(77), teamSizeMin: 3, teamSizeMax: 5 },
  autumn: { slug: "code-sprint-autumn-2026", name: "Code Sprint Autumn 2026", startsAt: at(-7), endsAt: at(-5), teamSizeMin: 2, teamSizeMax: 4 },
  monsoon: { slug: "monsoon-buildathon-2026", name: "Monsoon Build-a-thon 2026", startsAt: at(-62), endsAt: at(-60), teamSizeMin: 2, teamSizeMax: 4 },
} as const;
type HackKey = keyof typeof HACKATHONS;

async function removeDemoData() {
  const slugs = Object.values(HACKATHONS).map((h) => h.slug);
  // Who received feedback in demo hackathons, so their peer evidence can be rebuilt afterwards.
  const affected = await prisma.peerFeedback.findMany({
    where: { hackathon: { slug: { in: slugs } } },
    select: { toUserId: true },
    distinct: ["toUserId"],
  });
  // Cascades to teams, members, invites, participations and feedback.
  const h = await prisma.hackathon.deleteMany({ where: { slug: { in: slugs } } });
  const u = await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
  const survivors = await prisma.user.findMany({
    where: { id: { in: affected.map((a) => a.toUserId) } },
    select: { id: true },
  });
  for (const s of survivors) {
    await rebuildPeerEvidence(s.id);
    await recomputeUserScores(s.id);
  }
  console.log(`Removed ${h.count} demo hackathons and ${u.count} demo users.`);
}

async function main() {
  const me = await prisma.user.findUnique({ where: { email: MY_EMAIL }, select: { id: true, name: true } });
  if (!me) throw new Error(`No user with email ${MY_EMAIL}. Sign in once first.`);

  await removeDemoData();
  if (clean) {
    await recomputeUserScores(me.id);
    return;
  }

  // ---- skills ----------------------------------------------------------------
  const allSlugs = new Set(USERS.flatMap((u) => [...Object.keys(u.skills), ...Object.keys(u.github ?? {}), ...(u.resume ?? [])]));
  const catalog = await prisma.skill.findMany({ where: { slug: { in: [...allSlugs] } }, select: { id: true, slug: true } });
  const skillId = new Map(catalog.map((s) => [s.slug, s.id]));
  const missing = [...allSlugs].filter((s) => !skillId.has(s));
  if (missing.length) throw new Error(`Skills missing from the catalog (run \`npx prisma db seed\`): ${missing.join(", ")}`);

  // ---- users -----------------------------------------------------------------
  const id: Record<string, string> = { me: me.id };
  for (const [i, u] of USERS.entries()) {
    const handle = u.name.toLowerCase().replace(/[^a-z]+/g, "-");
    const created = await prisma.user.create({
      data: {
        name: u.name,
        email: `${u.key}@${DEMO_DOMAIN}`,
        createdAt: at(-90 + i),
        profile: {
          create: {
            bio: u.bio,
            githubUsername: u.github ? handle : null,
            interestTags: u.interests,
            availability: u.availability,
            onboardingCompletedAt: at(-80 + i),
            guideEndedAt: at(-79 + i),
          },
        },
        skills: { create: Object.entries(u.skills).map(([slug, level]) => ({ skillId: skillId.get(slug)!, level })) },
      },
      select: { id: true },
    });
    id[u.key] = created.id;

    const evidence = [];
    if (u.github) {
      evidence.push({
        userId: created.id,
        source: "GITHUB" as const,
        payload: {
          version: 2, username: handle, name: u.name, avatarUrl: null, verified: true,
          connectedAt: at(-70).toISOString(), reposScanned: 6 + (i % 9),
          skills: Object.entries(u.github).map(([slug, level]) => ({ slug, level })),
        },
      });
    }
    if (u.resume) {
      evidence.push({
        userId: created.id,
        source: "RESUME" as const,
        payload: { fileName: `${u.key}-resume.pdf`, extractedSkills: u.resume },
      });
    }
    if (evidence.length) await prisma.evidenceRecord.createMany({ data: evidence });
  }

  // ---- hackathons --------------------------------------------------------------
  const hid = {} as Record<HackKey, string>;
  for (const [key, h] of Object.entries(HACKATHONS) as [HackKey, (typeof HACKATHONS)[HackKey]][]) {
    hid[key] = (await prisma.hackathon.create({ data: { ...h, createdById: me.id, createdAt: at(-30) }, select: { id: true } })).id;
  }

  // ---- teams -------------------------------------------------------------------
  const tid: Record<string, string> = {};
  async function team(key: string, hack: HackKey, name: string, description: string, lookingFor: string[], members: string[], ageDays = 2) {
    const created = await prisma.team.create({
      data: {
        hackathonId: hid[hack], name, description, lookingFor, createdById: id[members[0]],
        createdAt: new Date(Math.min(now, HACKATHONS[hack].startsAt.getTime()) - ageDays * DAY),
        members: {
          create: members.map((m, i) => ({
            userId: id[m], hackathonId: hid[hack], role: i === 0 ? ("LEAD" as const) : ("MEMBER" as const),
            joinedAt: new Date(now - (ageDays + 1) * DAY + i * 3600_000 - (hack === "autumn" ? 10 * DAY : hack === "monsoon" ? 65 * DAY : 0)),
          })),
        },
      },
      select: { id: true },
    });
    tid[key] = created.id;
  }

  // Running now: you have no team, two invites waiting, one request sent.
  await team("pixel", "running", "Pixel Pushers", "Building an accessible design-system generator. Need someone strong on the backend.", ["nodejs", "postgresql"], ["meera", "ananya"], 4);
  await team("async", "running", "Async Avengers", "Realtime incident dashboard for campus Wi-Fi outages.", ["react", "go", "docker"], ["dev", "rohan"], 3);
  await team("quokka", "running", "Quantum Quokkas", "LLM tutor that explains DSA problems step by step.", ["python", "react-native"], ["priya", "arjun"], 2);
  await team("llama", "running", "Lambda Llamas", "Serverless expense splitter for hostels.", ["flutter", "google-cloud"], ["riya"], 1);
  await team("fullhouse", "running", "Full House", "We're full, just here to show a full team is hidden.", ["python"], ["harsh", "sneha", "zoya", "nikhil"], 5);

  // Upcoming: you lead a team, someone asked to join, you invited someone.
  await team("grid", "winter", "Grid Runners", "SkillGrid's own team. Mobile-first campus events app.", ["kotlin", "figma", "postgresql"], ["me", "aarav"], 2);
  await team("byte", "winter", "Byte Brigade", "Crop-disease detection from phone photos.", ["python", "pytorch", "flutter"], ["ishita", "tanvi"], 3);
  await team("nullptr", "winter", "Null Pointers", "Hardware hack: smart attendance with ESP32.", ["arduino", "cpp"], ["vikram", "arjun"], 1);
  await team("chain", "winter", "Chain Reaction", "On-chain certificates for college clubs.", ["solidity", "react"], ["nikhil"], 1);

  // Far upcoming: open teams to browse; you can create your own.
  await team("neural", "spring", "Neural Nomads", "Multilingual voice assistant for local languages.", ["python", "llms", "react"], ["priya", "ishita"], 1);
  await team("cloud9", "spring", "Cloud Nine", "Carbon-aware job scheduler.", ["kubernetes", "go"], ["riya", "rohan", "harsh"], 1);

  // Ended 5 days ago: feedback window is open, your teammates already rated you.
  await team("merge", "autumn", "Merge Conflict", "Placement-prep tracker with mock interview matching.", ["nextjs"], ["ananya", "me", "kabir", "sneha"], 1);
  await team("stack", "autumn", "Stack Smashers", "CTF practice platform.", ["linux"], ["dev", "arjun", "vikram"], 1);

  // Ended 2 months ago: feedback window closed, history only.
  await team("monsoon", "monsoon", "Rain Check", "Flood alert SMS bot.", ["python"], ["me", "harsh", "tanvi"], 1);

  // ---- participation ("looking for a team" flags) ------------------------------------
  const members = await prisma.teamMember.findMany({ where: { hackathonId: { in: Object.values(hid) } }, select: { hackathonId: true, userId: true } });
  const inTeam = new Set(members.map((m) => `${m.hackathonId}:${m.userId}`));
  const looking: [HackKey, string[]][] = [
    ["running", ["me", "aarav", "kabir", "tanvi", "vikram"]],
    ["winter", ["rohan", "kabir", "meera", "priya", "dev", "sneha", "zoya", "harsh", "riya", "ishita"]],
    ["spring", ["aarav", "meera", "kabir", "zoya", "dev", "tanvi", "nikhil"]],
  ];
  const participation = [
    ...members.map((m) => ({ hackathonId: m.hackathonId, userId: m.userId, lookingForTeam: false })),
    ...looking.flatMap(([hack, keys]) =>
      keys.filter((k) => !inTeam.has(`${hid[hack]}:${id[k]}`)).map((k) => ({ hackathonId: hid[hack], userId: id[k], lookingForTeam: true })),
    ),
  ];
  await prisma.participation.createMany({ data: participation, skipDuplicates: true });

  // ---- invites and requests ----------------------------------------------------------
  type Row = { team: string; hack: HackKey; user: string; kind: "INVITE" | "REQUEST"; by: string; status?: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; hoursAgo: number };
  const rows: Row[] = [
    // Invites to you (accept one and the other is cancelled automatically).
    { team: "pixel", hack: "running", user: "me", kind: "INVITE", by: "meera", hoursAgo: 5 },
    { team: "async", hack: "running", user: "me", kind: "INVITE", by: "dev", hoursAgo: 20 },
    // Your request to join a team (you can cancel it).
    { team: "quokka", hack: "running", user: "me", kind: "REQUEST", by: "me", hoursAgo: 8 },
    // Requests to your team, Grid Runners (accept or decline as lead).
    { team: "grid", hack: "winter", user: "kabir", kind: "REQUEST", by: "kabir", hoursAgo: 3 },
    { team: "grid", hack: "winter", user: "meera", kind: "REQUEST", by: "meera", hoursAgo: 30 },
    // Invites you sent as lead: one pending (cancel it), history below.
    { team: "grid", hack: "winter", user: "rohan", kind: "INVITE", by: "me", hoursAgo: 12 },
    { team: "grid", hack: "winter", user: "zoya", kind: "INVITE", by: "me", status: "DECLINED", hoursAgo: 50 },
    { team: "grid", hack: "winter", user: "aarav", kind: "INVITE", by: "me", status: "ACCEPTED", hoursAgo: 72 },
    { team: "merge", hack: "autumn", user: "me", kind: "REQUEST", by: "me", status: "ACCEPTED", hoursAgo: 24 * 10 },
    // Activity between other people, so their side looks lived-in.
    { team: "byte", hack: "winter", user: "priya", kind: "INVITE", by: "ishita", hoursAgo: 6 },
    { team: "llama", hack: "running", user: "tanvi", kind: "INVITE", by: "riya", hoursAgo: 9 },
  ];
  await prisma.teamInvite.createMany({
    data: rows.map((r) => {
      const createdAt = new Date(now - r.hoursAgo * 3600_000);
      const status = r.status ?? "PENDING";
      return {
        teamId: tid[r.team], hackathonId: hid[r.hack], userId: id[r.user], kind: r.kind, createdById: id[r.by], status, createdAt,
        respondedAt: status === "PENDING" ? null : new Date(createdAt.getTime() + 2 * 3600_000),
      };
    }),
  });

  // ---- peer feedback -----------------------------------------------------------------
  // [hackathon, team, from, to, skill, level]. Ratings must be on skills the target listed.
  const mySkills = new Map(
    (await prisma.userSkill.findMany({ where: { userId: me.id }, select: { skill: { select: { slug: true, id: true } } } })).map((s) => [s.skill.slug, s.skill.id]),
  );
  const pickMine = (wanted: string[]) => wanted.filter((s) => mySkills.has(s));
  const feedback: [HackKey, string, string, string, string, ComfortLevel][] = [
    ...pickMine(["react-native", "nextjs", "typescript"]).map((s, i) => ["autumn", "merge", "ananya", "me", s, ([A, I, I] as const)[i]] as [HackKey, string, string, string, string, ComfortLevel]),
    ...pickMine(["react-native", "nextjs", "python"]).map((s, i) => ["autumn", "merge", "kabir", "me", s, ([A, A, I] as const)[i]] as [HackKey, string, string, string, string, ComfortLevel]),
    ["autumn", "merge", "kabir", "ananya", "figma", A],
    ["autumn", "merge", "sneha", "ananya", "ui-ux-design", A],
    ["autumn", "merge", "ananya", "kabir", "kotlin", A],
    ["autumn", "merge", "ananya", "sneha", "sql", I],
    ["autumn", "stack", "arjun", "dev", "cybersecurity", A],
    ["autumn", "stack", "dev", "arjun", "cpp", A],
    ["monsoon", "monsoon", "harsh", "me", pickMine(["python"])[0] ?? "", I],
    ["monsoon", "monsoon", "me", "harsh", "django", A],
    ["monsoon", "monsoon", "tanvi", "harsh", "python", I],
  ];
  const slugToId = (slug: string) => skillId.get(slug) ?? mySkills.get(slug);
  await prisma.peerFeedback.createMany({
    data: feedback
      .filter(([, , , , slug]) => slug && slugToId(slug))
      .map(([hack, team, from, to, slug, level]) => ({
        hackathonId: hid[hack], teamId: tid[team], fromUserId: id[from], toUserId: id[to], skillId: slugToId(slug)!, level,
        createdAt: new Date(HACKATHONS[hack].endsAt.getTime() + DAY),
      })),
  });

  // ---- derived evidence and scores ----------------------------------------------------
  const rated = [...new Set(feedback.map((f) => id[f[3]]))];
  for (const u of rated) await rebuildPeerEvidence(u);
  for (const u of Object.values(id)) await recomputeUserScores(u);

  console.log(`Seeded ${USERS.length} demo users, ${Object.keys(hid).length} hackathons, ${Object.keys(tid).length} teams, ${rows.length} invites/requests, ${feedback.length} feedback ratings for ${MY_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
