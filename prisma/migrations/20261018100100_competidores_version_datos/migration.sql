-- Versión del formato de los datos de Competidores (para refrescar los análisis antiguos)
ALTER TABLE "VisibilitySnapshot" ADD COLUMN "dataVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Competitor" ADD COLUMN "contentGapVersion" INTEGER NOT NULL DEFAULT 1;
