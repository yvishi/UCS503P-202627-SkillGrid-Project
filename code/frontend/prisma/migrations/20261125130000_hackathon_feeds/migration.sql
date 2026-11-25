-- CreateEnum
CREATE TYPE "HackathonVisibility" AS ENUM ('PUBLISHED', 'PENDING', 'HIDDEN');

-- AlterTable
ALTER TABLE "hackathons" ALTER COLUMN "createdById" DROP NOT NULL,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "visibility" "HackathonVisibility" NOT NULL DEFAULT 'PUBLISHED';

-- CreateIndex
CREATE UNIQUE INDEX "hackathons_source_externalId_key" ON "hackathons"("source", "externalId");

-- An optional creator: deleting that admin's account leaves the hackathon in place.
ALTER TABLE "hackathons" DROP CONSTRAINT "hackathons_createdById_fkey";
ALTER TABLE "hackathons" ADD CONSTRAINT "hackathons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
