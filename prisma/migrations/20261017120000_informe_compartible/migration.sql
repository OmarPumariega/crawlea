-- Marca blanca del informe (por cuenta) y enlace/envío mensual del informe (por proyecto)
ALTER TABLE "User" ADD COLUMN "brandName" TEXT,
ADD COLUMN "brandLogo" TEXT,
ADD COLUMN "brandColor" TEXT;

ALTER TABLE "Project" ADD COLUMN "reportShareToken" TEXT,
ADD COLUMN "reportEmailTo" TEXT,
ADD COLUMN "reportEmailLastMonth" TEXT;

CREATE UNIQUE INDEX "Project_reportShareToken_key" ON "Project"("reportShareToken");
