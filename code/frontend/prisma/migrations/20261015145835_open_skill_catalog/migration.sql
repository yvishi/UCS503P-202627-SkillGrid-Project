-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'LIBRARY', 'TOOL', 'PLATFORM', 'DATABASE', 'DESIGN', 'CONCEPT', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillOrigin" AS ENUM ('CURATED', 'GITHUB', 'REQUESTED');

-- CreateEnum
CREATE TYPE "SkillRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'MERGED', 'REJECTED');

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "SkillCategory" NOT NULL DEFAULT 'OTHER',
    "origin" "SkillOrigin" NOT NULL DEFAULT 'CURATED',
    "strictMatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" "ComfortLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "skill_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestedLevel" "ComfortLevel" NOT NULL,
    "note" TEXT,
    "status" "SkillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedSkillId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "skills_keys_idx" ON "skills" USING GIN ("keys");

-- CreateIndex
CREATE INDEX "user_skills_skillId_idx" ON "user_skills"("skillId");

-- CreateIndex
CREATE INDEX "skill_requests_status_key_idx" ON "skill_requests"("status", "key");

-- CreateIndex
CREATE UNIQUE INDEX "skill_requests_userId_key_key" ON "skill_requests"("userId", "key");

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_requests" ADD CONSTRAINT "skill_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Copy existing self-ratings out of profiles."skillRatings" (JSON) into
-- user_skills. The legacy skills are inserted here first so the copy has
-- targets before `prisma db seed` fills in the rest of the catalog (the
-- seed then upserts these rows with their full aliases and keys).
-- ---------------------------------------------------------------------
INSERT INTO "skills" ("id", "slug", "name", "aliases", "keys", "category", "origin", "strictMatch") VALUES
  ('legacy_javascript', 'javascript', 'JavaScript', '{}', '{javascript}', 'LANGUAGE', 'CURATED', false),
  ('legacy_typescript', 'typescript', 'TypeScript', '{}', '{typescript}', 'LANGUAGE', 'CURATED', false),
  ('legacy_python', 'python', 'Python', '{}', '{python}', 'LANGUAGE', 'CURATED', false),
  ('legacy_java', 'java', 'Java', '{}', '{java}', 'LANGUAGE', 'CURATED', false),
  ('legacy_cpp', 'cpp', 'C++', '{}', '{cpp,c++}', 'LANGUAGE', 'CURATED', false),
  ('legacy_go', 'go', 'Go', '{}', '{go}', 'LANGUAGE', 'CURATED', true),
  ('legacy_react', 'react', 'React', '{}', '{react}', 'FRAMEWORK', 'CURATED', true),
  ('legacy_nextjs', 'nextjs', 'Next.js', '{}', '{nextjs}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_nodejs', 'nodejs', 'Node.js', '{}', '{nodejs}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_flutter', 'flutter', 'Flutter', '{}', '{flutter}', 'FRAMEWORK', 'CURATED', true),
  ('legacy_react_native', 'react-native', 'React Native', '{}', '{reactnative}', 'FRAMEWORK', 'CURATED', false),
  ('legacy_sql', 'sql', 'SQL', '{}', '{sql}', 'LANGUAGE', 'CURATED', false),
  ('legacy_docker', 'docker', 'Docker', '{}', '{docker}', 'TOOL', 'CURATED', false),
  ('legacy_kubernetes', 'kubernetes', 'Kubernetes', '{}', '{kubernetes}', 'TOOL', 'CURATED', false),
  ('legacy_aws', 'aws', 'AWS', '{}', '{aws}', 'PLATFORM', 'CURATED', false),
  ('legacy_git', 'git', 'Git', '{}', '{git}', 'TOOL', 'CURATED', false),
  ('legacy_figma', 'figma', 'Figma', '{}', '{figma}', 'DESIGN', 'CURATED', false),
  ('legacy_solidity', 'solidity', 'Solidity', '{}', '{solidity}', 'LANGUAGE', 'CURATED', false),
  ('legacy_pytorch', 'pytorch', 'PyTorch', '{}', '{pytorch}', 'LIBRARY', 'CURATED', false),
  ('legacy_tensorflow', 'tensorflow', 'TensorFlow', '{}', '{tensorflow}', 'LIBRARY', 'CURATED', false),
  ('legacy_pandas', 'pandas', 'Pandas', '{}', '{pandas}', 'LIBRARY', 'CURATED', true),
  ('legacy_numpy', 'numpy', 'NumPy', '{}', '{numpy}', 'LIBRARY', 'CURATED', false)
ON CONFLICT ("slug") DO NOTHING;

-- Old slug -> new slug(s). The two combined entries split into two rows
-- each at the same level. Entries with any other key, or a level that
-- isn't one of the three enum values, are skipped rather than failing.
INSERT INTO "user_skills" ("userId", "skillId", "level", "createdAt")
SELECT p."userId", s."id", r.value::"ComfortLevel", NOW()
FROM "profiles" p
CROSS JOIN LATERAL jsonb_each_text(p."skillRatings") AS r(key, value)
JOIN (VALUES
  ('javascript', 'javascript'), ('typescript', 'typescript'), ('python', 'python'),
  ('java', 'java'), ('cpp', 'cpp'), ('go', 'go'), ('react', 'react'), ('nextjs', 'nextjs'),
  ('nodejs', 'nodejs'), ('flutter', 'flutter'), ('react-native', 'react-native'), ('sql', 'sql'),
  ('docker', 'docker'), ('kubernetes', 'kubernetes'), ('aws', 'aws'), ('git', 'git'),
  ('figma', 'figma'), ('solidity', 'solidity'),
  ('pytorch-tensorflow', 'pytorch'), ('pytorch-tensorflow', 'tensorflow'),
  ('pandas-numpy', 'pandas'), ('pandas-numpy', 'numpy')
) AS m(old_slug, new_slug) ON m.old_slug = r.key
JOIN "skills" s ON s."slug" = m.new_slug
WHERE r.value IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
ON CONFLICT ("userId", "skillId") DO NOTHING;
