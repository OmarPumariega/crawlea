import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; promptId: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id, promptId } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return projectNotFound();
  // El filtro por projectId impide borrar la pregunta de otro proyecto.
  const res = await prisma.aiPrompt.deleteMany({ where: { id: promptId, projectId: id } });
  if (res.count === 0) return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
