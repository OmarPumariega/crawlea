-- Competidores: valor del tráfico, movimiento de keywords y presencia de pago
ALTER TABLE "VisibilitySnapshot" ADD COLUMN "trafficValue" DOUBLE PRECISION,
ADD COLUMN "movement" JSONB,
ADD COLUMN "paid" JSONB;
