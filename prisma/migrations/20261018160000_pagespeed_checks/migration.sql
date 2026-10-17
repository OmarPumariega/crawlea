CREATE TABLE "PageSpeedCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "performance" INTEGER,
    "accessibility" INTEGER,
    "bestPractices" INTEGER,
    "seo" INTEGER,
    "lcpMs" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "inpMs" DOUBLE PRECISION,
    "fieldData" JSONB,
    "opportunities" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSpeedCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageSpeedCheck_projectId_url_strategy_fetchedAt_idx" ON "PageSpeedCheck"("projectId", "url", "strategy", "fetchedAt");

ALTER TABLE "PageSpeedCheck" ADD CONSTRAINT "PageSpeedCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
