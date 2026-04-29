-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN "playDayId" TEXT;

-- CreateTable
CREATE TABLE "public"."PlayRound" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "roundKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayDay" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "playRoundId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DayAbsence" (
    "id" TEXT NOT NULL,
    "playDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayRound_clubId_roundKey_key" ON "public"."PlayRound"("clubId", "roundKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlayDay_clubId_dateKey_key" ON "public"."PlayDay"("clubId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DayAbsence_playDayId_playerId_key" ON "public"."DayAbsence"("playDayId", "playerId");

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_playDayId_fkey" FOREIGN KEY ("playDayId") REFERENCES "public"."PlayDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayRound" ADD CONSTRAINT "PlayRound_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayDay" ADD CONSTRAINT "PlayDay_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayDay" ADD CONSTRAINT "PlayDay_playRoundId_fkey" FOREIGN KEY ("playRoundId") REFERENCES "public"."PlayRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DayAbsence" ADD CONSTRAINT "DayAbsence_playDayId_fkey" FOREIGN KEY ("playDayId") REFERENCES "public"."PlayDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DayAbsence" ADD CONSTRAINT "DayAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
