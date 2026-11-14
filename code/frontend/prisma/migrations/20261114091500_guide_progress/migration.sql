-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "guideEndedAt" TIMESTAMP(3),
ADD COLUMN     "guideSeenSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
