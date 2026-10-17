-- Analizador de URL: historial de análisis por proyecto
CREATE TABLE "UrlAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "keyword" TEXT,
    "score" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UrlAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UrlAnalysis_projectId_createdAt_idx" ON "UrlAnalysis"("projectId", "createdAt");
CREATE INDEX "UrlAnalysis_projectId_url_createdAt_idx" ON "UrlAnalysis"("projectId", "url", "createdAt");
ALTER TABLE "UrlAnalysis" ADD CONSTRAINT "UrlAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
