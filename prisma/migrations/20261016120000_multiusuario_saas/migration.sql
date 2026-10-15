-- Multiusuario SaaS: los proyectos pasan a tener dueño (User), la conexión de
-- Google es por usuario y User gana perfil Google + suscripción. Los datos del
-- single-tenant (todos los proyectos, la conexión de Google de la agencia y los
-- avisos) se asignan al primer admin existente.

-- DropIndex
-- La clave de dedupe de avisos pasa a incluir al usuario: la misma auditoría
-- de dos usuarios distintos son dos avisos distintos.
DROP INDEX "NotificationLog_type_key_key";

-- AlterTable
-- GoogleConnection: antes fila única "singleton" de la agencia; ahora una
-- conexión por usuario (userId unique). Se añade nullable, se backfilla y
-- luego se marca NOT NULL para no romper las filas existentes.
ALTER TABLE "GoogleConnection" ADD COLUMN     "userId" TEXT;
UPDATE "GoogleConnection" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "GoogleConnection" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "GoogleConnection" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "userId" TEXT;
UPDATE "NotificationLog" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "NotificationLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
-- Project: cada proyecto pertenece a un usuario. Es la base del aislamiento
-- multi-tenant (toda consulta de API filtra por userId).
ALTER TABLE "Project" ADD COLUMN     "userId" TEXT;
UPDATE "Project" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
-- User: password nullable (usuarios Google no tienen), perfil OAuth, estado
-- (suspensión) y campos de suscripción sincronizados por Stripe.
ALTER TABLE "User" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planStatus" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'user';

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_userId_key" ON "GoogleConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_type_key_key" ON "NotificationLog"("userId", "type", "key");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
