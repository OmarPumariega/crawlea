-- Auditoría profunda (checks tipo Microaudit sobre la home): se guarda aparte
-- de overallScore para que el histórico de puntuaciones siga siendo comparable.
ALTER TABLE "AuditRun" ADD COLUMN "deepChecks" JSONB;
ALTER TABLE "AuditRun" ADD COLUMN "deepScore" DOUBLE PRECISION;
