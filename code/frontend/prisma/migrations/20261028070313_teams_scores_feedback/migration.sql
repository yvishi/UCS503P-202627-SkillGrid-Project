-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('INVITE', 'REQUEST');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "evidenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoreUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "skill_scores" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_scores_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "hackathons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "teamSizeMin" INTEGER NOT NULL DEFAULT 2,
    "teamSizeMax" INTEGER NOT NULL DEFAULT 4,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hackathons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lookingFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookingForTeam" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("hackathonId","userId")
);

-- CreateTable
CREATE TABLE "peer_feedback" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" "ComfortLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_scores_skillId_score_idx" ON "skill_scores"("skillId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "hackathons_slug_key" ON "hackathons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_hackathonId_name_key" ON "teams"("hackathonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_hackathonId_userId_key" ON "team_members"("hackathonId", "userId");

-- CreateIndex
CREATE INDEX "team_invites_userId_status_idx" ON "team_invites"("userId", "status");

-- CreateIndex
CREATE INDEX "team_invites_teamId_status_idx" ON "team_invites"("teamId", "status");

-- CreateIndex
CREATE INDEX "participations_hackathonId_lookingForTeam_idx" ON "participations"("hackathonId", "lookingForTeam");

-- CreateIndex
CREATE INDEX "peer_feedback_toUserId_idx" ON "peer_feedback"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "peer_feedback_hackathonId_fromUserId_toUserId_skillId_key" ON "peer_feedback"("hackathonId", "fromUserId", "toUserId", "skillId");

-- AddForeignKey
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathons" ADD CONSTRAINT "hackathons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
