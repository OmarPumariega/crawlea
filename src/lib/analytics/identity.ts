import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";

// Identidad anónima para analítica: HMAC del id de usuario con un secreto del
// servidor. No es reversible sin el secreto y no contiene email ni nombre.
export async function analyticsIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, role: true, createdAt: true },
  });
  if (!user) return null;
  const userKey = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev")
    .update(`analytics:${userId}`)
    .digest("hex")
    .slice(0, 20);
  return {
    userKey,
    plan: user.plan,
    internal: user.role === "admin",
    justCreated: Date.now() - user.createdAt.getTime() < 10 * 60 * 1000,
  };
}
