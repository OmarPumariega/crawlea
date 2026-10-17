-- Panorama del SERP (bloques, pack local, snippet destacado) en cada chequeo de Rank Tracking y en la caché de SERP
ALTER TABLE "RankPosition" ADD COLUMN "serp" JSONB;
ALTER TABLE "SerpCache" ADD COLUMN "panorama" JSONB;
