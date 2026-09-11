// Placeholder data for dashboard sections that don't have real matching
// logic yet (see spec section 9). Not database-backed. Replace with real
// queries once teammate/team matching ships.

export type TeammateFixture = {
  id: string;
  name: string;
  headline: string;
  tags: string[];
  strength: number; // 0-100, stands in for a future profile-strength score
};

export const TEAMMATE_FIXTURES: TeammateFixture[] = [
  {
    id: "t1",
    name: "Ananya Rao",
    headline: "Backend · Cloud",
    tags: ["Node.js", "PostgreSQL", "AWS"],
    strength: 82,
  },
  {
    id: "t2",
    name: "Rohan Mehta",
    headline: "Frontend · Design (UI/UX)",
    tags: ["React", "Figma", "TypeScript"],
    strength: 74,
  },
  {
    id: "t3",
    name: "Simran Kaur",
    headline: "Machine Learning · Data Science",
    tags: ["Python", "PyTorch", "Pandas"],
    strength: 91,
  },
  {
    id: "t4",
    name: "Devraj Singh",
    headline: "DevOps · Backend",
    tags: ["Docker", "Kubernetes", "Go"],
    strength: 68,
  },
];

export type TeamFixture = {
  id: string;
  name: string;
  event: string;
  lookingFor: string[];
  members: string[];
  openSlots: number;
};

export const TEAM_FIXTURES: TeamFixture[] = [
  {
    id: "g1",
    name: "Nightowls",
    event: "HackThapar 2026",
    lookingFor: ["Frontend", "Design (UI/UX)"],
    members: ["Kabir", "Ishita"],
    openSlots: 2,
  },
  {
    id: "g2",
    name: "ByteForce",
    event: "Smart India Hackathon",
    lookingFor: ["Machine Learning"],
    members: ["Aarav", "Meera", "Yusuf"],
    openSlots: 1,
  },
  {
    id: "g3",
    name: "Loopback",
    event: "HackThapar 2026",
    lookingFor: ["Backend", "Cloud"],
    members: ["Tanvi"],
    openSlots: 3,
  },
];
