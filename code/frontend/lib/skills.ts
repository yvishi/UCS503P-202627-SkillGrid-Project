// Fixed skill list for onboarding v2 (spec section 7). One list, used
// consistently by both the manual skills screen and the resume-parse
// keyword matcher — never improvised per screen.
//
// Slugs are what get stored (Profile.skillRatings keys, resume-parse
// matches); labels are what's shown. Keep slugs stable once shipped.

export const SKILLS = [
  { slug: "javascript", label: "JavaScript" },
  { slug: "typescript", label: "TypeScript" },
  { slug: "python", label: "Python" },
  { slug: "java", label: "Java" },
  { slug: "cpp", label: "C++" },
  { slug: "go", label: "Go" },
  { slug: "react", label: "React" },
  { slug: "nextjs", label: "Next.js" },
  { slug: "nodejs", label: "Node.js" },
  { slug: "flutter", label: "Flutter" },
  { slug: "react-native", label: "React Native" },
  { slug: "sql", label: "SQL / Databases" },
  { slug: "docker", label: "Docker" },
  { slug: "kubernetes", label: "Kubernetes" },
  { slug: "aws", label: "AWS" },
  { slug: "git", label: "Git" },
  { slug: "pytorch-tensorflow", label: "PyTorch / TensorFlow" },
  { slug: "pandas-numpy", label: "Pandas / NumPy" },
  { slug: "figma", label: "Figma" },
  { slug: "solidity", label: "Solidity" },
] as const;

export type SkillSlug = (typeof SKILLS)[number]["slug"];

export function isSkillSlug(value: string): value is SkillSlug {
  return SKILLS.some((s) => s.slug === value);
}

export function skillLabel(slug: string): string {
  return SKILLS.find((s) => s.slug === slug)?.label ?? slug;
}

export const SKILL_RATING_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type SkillRatingLevel = (typeof SKILL_RATING_LEVELS)[number];

// Distinct wording from the profile-wide ComfortLevel labels — spec
// section 4.2/5.1 calls for "Just starting / Comfortable / Confident"
// specifically for the per-skill selector.
export const SKILL_RATING_LABELS: Record<SkillRatingLevel, string> = {
  BEGINNER: "Just starting",
  INTERMEDIATE: "Comfortable",
  ADVANCED: "Confident",
};

export function isSkillRatingLevel(value: string): value is SkillRatingLevel {
  return (SKILL_RATING_LEVELS as readonly string[]).includes(value);
}

export type SkillRatings = Partial<Record<SkillSlug, SkillRatingLevel>>;

// Profile.skillRatings is stored as Prisma Json; narrow it back to a typed
// SkillRatings when reading, dropping anything that doesn't match the
// current fixed list (e.g. a skill slug retired after this was written).
export function parseSkillRatings(value: unknown): SkillRatings {
  if (typeof value !== "object" || value === null) return {};
  const result: SkillRatings = {};
  for (const [slug, level] of Object.entries(value as Record<string, unknown>)) {
    if (isSkillSlug(slug) && typeof level === "string" && isSkillRatingLevel(level)) {
      result[slug] = level;
    }
  }
  return result;
}

// Keyword variants used by the slow-parse keyword matcher (lib/resume-parser.ts)
// to catch common spellings/aliases a resume might use for a given skill.
export const SKILL_KEYWORDS: Record<SkillSlug, string[]> = {
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  python: ["python"],
  java: ["java"],
  cpp: ["c++", "cpp"],
  go: ["golang", " go "],
  react: ["react.js", "reactjs", "react"],
  nextjs: ["next.js", "nextjs"],
  nodejs: ["node.js", "nodejs", "node"],
  flutter: ["flutter"],
  "react-native": ["react native"],
  sql: ["sql", "postgres", "postgresql", "mysql", "mongodb"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  aws: ["aws", "amazon web services"],
  git: ["git", "github", "gitlab"],
  "pytorch-tensorflow": ["pytorch", "tensorflow"],
  "pandas-numpy": ["pandas", "numpy"],
  figma: ["figma"],
  solidity: ["solidity"],
};
