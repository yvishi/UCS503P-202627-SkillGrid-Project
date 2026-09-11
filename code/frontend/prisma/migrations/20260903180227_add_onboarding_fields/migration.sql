-- CreateEnum
CREATE TYPE "ComfortLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('WEEKDAYS', 'WEEKENDS', 'BOTH', 'FLEXIBLE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "availability" "Availability",
ADD COLUMN     "comfortLevel" "ComfortLevel",
ADD COLUMN     "interestTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "projectLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
