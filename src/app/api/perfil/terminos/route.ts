import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { LEGAL_VERSION } from "@/lib/legal/company";

// Registra que la persona ha aceptado los términos y la privacidad vigentes.
export async function POST() {
  const session = await requireSession();
  if (!session) return unauthorized();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION },
  });
  return NextResponse.json({ ok: true });
}
