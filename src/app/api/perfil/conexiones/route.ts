import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";

// Aplicaciones a las que el usuario ha dado permiso por el conector OAuth del
// MCP (Claude, ChatGPT, Cursor...). Revocar corta su acceso al instante: el
// access token deja de valer en la siguiente llamada.

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const grants = await prisma.oAuthGrant.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, lastUsedAt: true, client: { select: { name: true } } },
  });
  return NextResponse.json(grants);
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const result = await prisma.oAuthGrant.updateMany({
    where: { id, userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
