CREATE TABLE "ChangeLog" (
 "id" TEXT NOT NULL, "clubId" TEXT NOT NULL, "actorId" TEXT, "actorName" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "entityKey" TEXT NOT NULL, "summary" TEXT NOT NULL,
 "before" JSONB NOT NULL, "after" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "undoneAt" TIMESTAMP(3), "undoneBy" TEXT, CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChangeLog_clubId_createdAt_idx" ON "ChangeLog"("clubId", "createdAt");
