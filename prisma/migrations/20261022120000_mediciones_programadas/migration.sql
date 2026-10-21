CREATE TABLE "MeasurementSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeasurementSchedule_projectId_module_key" ON "MeasurementSchedule"("projectId", "module");

CREATE INDEX "MeasurementSchedule_enabled_nextRunAt_idx" ON "MeasurementSchedule"("enabled", "nextRunAt");

ALTER TABLE "MeasurementSchedule" ADD CONSTRAINT "MeasurementSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
