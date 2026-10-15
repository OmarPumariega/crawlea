import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Desconecta la cuenta de Google del USUARIO autenticado (una conexión
  // por usuario en el SaaS).
  await prisma.googleConnection.deleteMany({ where: { userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
