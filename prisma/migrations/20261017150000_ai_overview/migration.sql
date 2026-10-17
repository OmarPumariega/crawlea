-- AI Overview de Google por keyword del Rank Tracking
CREATE TABLE "AiOverviewCheck" (
    "id" TEXT NOT NULL,
    "rankKeywordId" TEXT NOT NULL,
    "hasOverview" BOOLEAN NOT NULL,
    "cited" BOOLEAN NOT NULL,
    "citedRank" INTEGER,
    "references" JSONB NOT NULL,
    "excerpt" TEXT,
    "costUsd" DECIMAL(10,6),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiOverviewCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiOverviewCheck_rankKeywordId_checkedAt_idx" ON "AiOverviewCheck"("rankKeywordId", "checkedAt");
ALTER TABLE "AiOverviewCheck" ADD CONSTRAINT "AiOverviewCheck_rankKeywordId_fkey" FOREIGN KEY ("rankKeywordId") REFERENCES "RankKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
