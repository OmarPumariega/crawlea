-- Registro de la aceptación de términos y privacidad (clickwrap dentro de la app).
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
