-- CreateEnum
CREATE TYPE "public"."MatchSource" AS ENUM ('MANUAL', 'SWEBOWL');

-- AlterTable
ALTER TABLE "public"."Club" ADD COLUMN "swebowlClub" TEXT,
ADD COLUMN "swebowlSeason" INTEGER,
ADD COLUMN "swebowlTeamIds" TEXT;

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN "externalId" TEXT,
ADD COLUMN "source" "public"."MatchSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceTeamName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_clubId_externalId_key" ON "public"."Match"("clubId", "externalId");
