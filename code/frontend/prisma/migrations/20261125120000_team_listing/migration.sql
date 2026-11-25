-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false;

-- Teams created before listing existed were all shown in discovery; keep them shown.
UPDATE "teams" SET "listed" = true;
