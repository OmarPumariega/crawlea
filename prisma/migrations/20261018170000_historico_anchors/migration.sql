ALTER TABLE "BacklinkSnapshot" ADD COLUMN "anchors" JSONB, ADD COLUMN "newLost" JSONB;

CREATE TABLE "TrafficHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrafficHistory_projectId_domain_fetchedAt_idx" ON "TrafficHistory"("projectId", "domain", "fetchedAt");

ALTER TABLE "TrafficHistory" ADD CONSTRAINT "TrafficHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
