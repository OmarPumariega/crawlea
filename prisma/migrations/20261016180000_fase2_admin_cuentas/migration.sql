-- Fase 2 SaaS: gestión manual de cuentas desde el panel de administración.
ALTER TABLE "User" ADD COLUMN "planOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "spendLimitOverrideUsd" DOUBLE PRECISION;
